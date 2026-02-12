#!/usr/bin/env node

/**
 * Script de Validación Completa del Sistema WhatsApp 360Dialog
 * Fecha: 27 de Octubre, 2025
 * Version: 1.0.0
 */

import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import axios from 'axios';
import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Colores para la consola
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

class SystemValidator {
    constructor() {
        this.results = {
            passed: [],
            warnings: [],
            errors: [],
            info: []
        };
        this.apiKey = process.env.D360_API_KEY || process.env.DIALOG360_API_KEY;
    }

    log(type, message, detail = '') {
        const icons = {
            pass: '✅',
            warning: '⚠️',
            error: '❌',
            info: 'ℹ️'
        };
        
        const colorMap = {
            pass: colors.green,
            warning: colors.yellow,
            error: colors.red,
            info: colors.cyan
        };

        console.log(`${colorMap[type]}${icons[type]} ${message}${colors.reset}`);
        if (detail) {
            console.log(`   ${detail}`);
        }

        // Guardar resultado
        if (type === 'pass') this.results.passed.push(message);
        else if (type === 'warning') this.results.warnings.push(message);
        else if (type === 'error') this.results.errors.push(message);
        else this.results.info.push(message);
    }

    async validate() {
        console.log(`${colors.blue}${'='.repeat(60)}${colors.reset}`);
        console.log(`${colors.blue}VALIDACIÓN COMPLETA DEL SISTEMA - WHATSAPP 360DIALOG${colors.reset}`);
        console.log(`${colors.blue}${'='.repeat(60)}${colors.reset}\n`);

        // 1. Estructura del Entorno
        await this.validateEnvironmentStructure();
        
        // 2. Backend y API
        await this.validateBackendAPI();
        
        // 3. Base de Datos
        await this.validateDatabase();
        
        // 4. Integración 360Dialog
        await this.validate360DialogIntegration();
        
        // 5. Frontend
        await this.validateFrontend();
        
        // 6. Logs y Monitoreo
        await this.validateLogs();
        
        // 7. Validaciones Funcionales
        await this.validateFunctionality();
        
        // 8. Seguridad
        await this.validateSecurity();
        
        // 9. Backups
        await this.validateBackups();
        
        // Resumen Final
        this.printSummary();
    }

    async validateEnvironmentStructure() {
        console.log(`\n${colors.cyan}🧱 1. ESTRUCTURA DEL ENTORNO${colors.reset}`);
        
        // Verificar directorios
        const requiredDirs = ['src', 'client', 'data', 'logs', 'public', 'backups'];
        for (const dir of requiredDirs) {
            const dirPath = path.join(__dirname, dir);
            if (fs.existsSync(dirPath)) {
                this.log('pass', `Directorio /${dir} existe`);
            } else {
                this.log('error', `Directorio /${dir} no encontrado`);
            }
        }

        // Verificar archivos críticos
        const criticalFiles = ['server.js', '.env', 'package.json', '.env.cleaned'];
        for (const file of criticalFiles) {
            const filePath = path.join(__dirname, file);
            if (fs.existsSync(filePath)) {
                const stats = fs.statSync(filePath);
                this.log('pass', `Archivo ${file} existe`, `Tamaño: ${(stats.size / 1024).toFixed(2)} KB`);
            } else {
                this.log('error', `Archivo ${file} no encontrado`);
            }
        }

        // Verificar versiones
        try {
            const { stdout: nodeVersion } = await execAsync('node -v');
            const { stdout: npmVersion } = await execAsync('npm -v');
            this.log('pass', `Node.js ${nodeVersion.trim()}`);
            this.log('pass', `NPM ${npmVersion.trim()}`);
        } catch (error) {
            this.log('error', 'Error verificando versiones', error.message);
        }

        // Verificar variables de entorno
        const requiredEnvVars = ['PORT', 'NODE_ENV', 'D360_API_KEY', 'JWT_SECRET'];
        const envContent = fs.readFileSync('.env', 'utf8');
        
        for (const envVar of requiredEnvVars) {
            if (envContent.includes(`${envVar}=`)) {
                this.log('pass', `Variable de entorno ${envVar} configurada`);
            } else {
                this.log('error', `Variable de entorno ${envVar} no encontrada`);
            }
        }
    }

    async validateBackendAPI() {
        console.log(`\n${colors.cyan}⚙️ 2. BACKEND Y API${colors.reset}`);

        try {
            // Verificar salud del servidor
            const healthResponse = await axios.get('http://localhost:3000/api/health');
            if (healthResponse.data.success) {
                this.log('pass', 'Endpoint /api/health respondiendo', 
                    `Version: ${healthResponse.data.version}, Uptime: ${Math.floor(healthResponse.data.uptime / 60)} min`);
            }

            // Verificar webhook endpoint
            try {
                await axios.post('http://localhost:3000/api/webhook/360dialog', {
                    test: true
                });
                this.log('pass', 'Endpoint webhook 360Dialog accesible');
            } catch (error) {
                if (error.response && error.response.status < 500) {
                    this.log('pass', 'Endpoint webhook 360Dialog accesible');
                } else {
                    this.log('warning', 'Webhook endpoint respondió con error', error.message);
                }
            }

            // Verificar otros endpoints críticos
            const endpoints = [
                { path: '/api/status', method: 'GET' },
                { path: '/api/campaigns', method: 'GET' },
                { path: '/api/contacts', method: 'GET' }
            ];

            for (const endpoint of endpoints) {
                try {
                    const response = await axios({
                        method: endpoint.method,
                        url: `http://localhost:3000${endpoint.path}`
                    });
                    this.log('pass', `Endpoint ${endpoint.path} funcionando`);
                } catch (error) {
                    if (error.response && error.response.status === 401) {
                        this.log('warning', `Endpoint ${endpoint.path} requiere autenticación`);
                    } else {
                        this.log('error', `Endpoint ${endpoint.path} no responde`, error.message);
                    }
                }
            }
        } catch (error) {
            this.log('error', 'Servidor no está respondiendo', 
                'Asegúrate de que el servidor esté corriendo: npm run start');
        }
    }

    async validateDatabase() {
        console.log(`\n${colors.cyan}💾 3. BASE DE DATOS${colors.reset}`);

        const dbPath = path.join(__dirname, 'data', 'database.sqlite');
        
        if (!fs.existsSync(dbPath)) {
            this.log('error', 'Base de datos no encontrada', dbPath);
            return;
        }

        const db = new sqlite3.Database(dbPath);
        
        return new Promise((resolve) => {
            // Verificar tablas
            db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, tables) => {
                if (err) {
                    this.log('error', 'Error accediendo a la base de datos', err.message);
                    db.close();
                    resolve();
                    return;
                }

                const tableNames = tables.map(t => t.name);
                const requiredTables = [
                    'campaigns', 'contacts', 'messages', 'campaign_messages',
                    'interactive_responses', 'users', 'settings', 
                    'audit_logs', 'message_queue', 'rate_limits'
                ];

                for (const table of requiredTables) {
                    if (tableNames.includes(table)) {
                        this.log('pass', `Tabla ${table} existe`);
                    } else {
                        this.log('error', `Tabla ${table} no encontrada`);
                    }
                }

                // Verificar índices
                db.all("SELECT name FROM sqlite_master WHERE type='index'", (err, indexes) => {
                    if (err) {
                        this.log('error', 'Error verificando índices', err.message);
                    } else {
                        this.log('info', `Total de índices: ${indexes.length}`);
                        if (indexes.length > 50) {
                            this.log('pass', 'Índices de optimización creados');
                        } else {
                            this.log('warning', 'Pocos índices detectados', 
                                'Considera ejecutar fix-critical-safe.sql');
                        }
                    }

                    // Verificar columnas críticas en campaigns
                    db.all("PRAGMA table_info(campaigns)", (err, columns) => {
                        if (err) {
                            this.log('error', 'Error verificando estructura de campaigns', err.message);
                        } else {
                            const columnNames = columns.map(c => c.name);
                            if (columnNames.includes('user_id') && columnNames.includes('template_id')) {
                                this.log('pass', 'Columnas user_id y template_id presentes en campaigns');
                            } else {
                                this.log('error', 'Columnas críticas faltantes en campaigns',
                                    'Ejecuta: sqlite3 data/database.sqlite < fix-critical-safe.sql');
                            }
                        }
                        
                        db.close();
                        resolve();
                    });
                });
            });
        });
    }

    async validate360DialogIntegration() {
        console.log(`\n${colors.cyan}🔗 4. INTEGRACIÓN 360DIALOG${colors.reset}`);

        if (!this.apiKey) {
            this.log('error', 'API Key de 360Dialog no configurada');
            return;
        }

        this.log('pass', 'API Key de 360Dialog configurada');

        try {
            // Verificar configuración
            const configResponse = await axios.get(
                'https://waba-v2.360dialog.io/v1/configs/webhook',
                {
                    headers: {
                        'D360-API-KEY': this.apiKey
                    }
                }
            );

            if (configResponse.data) {
                this.log('pass', 'Conexión con 360Dialog exitosa');
                if (configResponse.data.url) {
                    this.log('info', `Webhook configurado: ${configResponse.data.url}`);
                } else {
                    this.log('warning', 'Webhook no configurado en 360Dialog');
                }
            }

            // Verificar cuenta
            const accountResponse = await axios.get(
                'https://waba-v2.360dialog.io/v1/account',
                {
                    headers: {
                        'D360-API-KEY': this.apiKey
                    }
                }
            );

            if (accountResponse.data) {
                this.log('pass', 'Cuenta 360Dialog verificada',
                    `ID: ${accountResponse.data.id || 'N/A'}`);
            }
        } catch (error) {
            if (error.response && error.response.status === 401) {
                this.log('error', 'API Key de 360Dialog inválida');
            } else {
                this.log('error', 'Error conectando con 360Dialog', error.message);
            }
        }
    }

    async validateFrontend() {
        console.log(`\n${colors.cyan}🖥️ 5. FRONTEND${colors.reset}`);

        const frontendPages = [
            '/dashboard',
            '/chat-live',
            '/contacts',
            '/campaigns',
            '/campaigns-improved.html',
            '/templates'
        ];

        for (const page of frontendPages) {
            try {
                const response = await axios.get(`http://localhost:3000${page}`);
                if (response.status === 200) {
                    this.log('pass', `Página ${page} accesible`);
                } else if (response.status === 302) {
                    this.log('warning', `Página ${page} redirigiendo (auth requerida)`);
                }
            } catch (error) {
                if (error.response && error.response.status === 302) {
                    this.log('warning', `Página ${page} requiere autenticación`);
                } else if (error.response && error.response.status === 404) {
                    this.log('error', `Página ${page} no encontrada`);
                } else {
                    this.log('error', `Error accediendo a ${page}`, error.message);
                }
            }
        }

        // Verificar assets estáticos
        const staticFiles = [
            '/css/bootstrap.min.css',
            '/js/campaigns-improved-init.js',
            '/js/utils/common.js'
        ];

        for (const file of staticFiles) {
            const filePath = path.join(__dirname, 'public', file.slice(1));
            if (fs.existsSync(filePath)) {
                this.log('pass', `Asset estático ${file} existe`);
            } else {
                this.log('warning', `Asset estático ${file} no encontrado`);
            }
        }
    }

    async validateLogs() {
        console.log(`\n${colors.cyan}📊 6. LOGS Y MONITOREO${colors.reset}`);

        const logsDir = path.join(__dirname, 'logs');
        
        if (!fs.existsSync(logsDir)) {
            this.log('error', 'Directorio de logs no existe');
            return;
        }

        const logFiles = fs.readdirSync(logsDir);
        this.log('info', `Total de archivos de log: ${logFiles.length}`);

        // Verificar logs recientes
        const today = new Date().toISOString().split('T')[0];
        const todayLog = `${today}.log`;
        
        if (logFiles.includes(todayLog)) {
            this.log('pass', `Log de hoy (${todayLog}) existe`);
            
            // Verificar tamaño
            const logPath = path.join(logsDir, todayLog);
            const stats = fs.statSync(logPath);
            const sizeMB = stats.size / (1024 * 1024);
            
            if (sizeMB > 50) {
                this.log('warning', `Log muy grande: ${sizeMB.toFixed(2)} MB`,
                    'Considera implementar rotación de logs');
            } else {
                this.log('pass', `Tamaño de log actual: ${sizeMB.toFixed(2)} MB`);
            }

            // Buscar errores recientes
            const logContent = fs.readFileSync(logPath, 'utf8');
            const errorCount = (logContent.match(/error/gi) || []).length;
            const warnCount = (logContent.match(/warn/gi) || []).length;
            
            this.log('info', `Errores en log de hoy: ${errorCount}, Advertencias: ${warnCount}`);
            
            if (errorCount > 100) {
                this.log('warning', 'Muchos errores en el log', 'Revisar logs para identificar problemas');
            }
        } else {
            this.log('warning', 'Log de hoy no encontrado');
        }
    }

    async validateFunctionality() {
        console.log(`\n${colors.cyan}🧠 7. VALIDACIONES FUNCIONALES${colors.reset}`);

        // Esta sección requeriría pruebas más complejas
        // Por ahora validaremos la estructura básica

        try {
            // Verificar que podemos obtener contactos
            const contactsResponse = await axios.get('http://localhost:3000/api/contacts')
                .catch(err => ({ data: null, error: err }));
            
            if (contactsResponse.data) {
                this.log('pass', 'API de contactos respondiendo');
            } else {
                this.log('warning', 'API de contactos requiere autenticación o no está disponible');
            }

            // Verificar estructura de campañas
            const campaignsResponse = await axios.get('http://localhost:3000/api/campaigns')
                .catch(err => ({ data: null, error: err }));
            
            if (campaignsResponse.data) {
                this.log('pass', 'API de campañas respondiendo');
            } else {
                this.log('warning', 'API de campañas requiere autenticación o no está disponible');
            }
        } catch (error) {
            this.log('error', 'Error en validaciones funcionales', error.message);
        }
    }

    async validateSecurity() {
        console.log(`\n${colors.cyan}🔐 8. SEGURIDAD${colors.reset}`);

        // Verificar .gitignore
        const gitignorePath = path.join(__dirname, '.gitignore');
        if (fs.existsSync(gitignorePath)) {
            const gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
            if (gitignoreContent.includes('.env')) {
                this.log('pass', '.env está en .gitignore');
            } else {
                this.log('error', '.env NO está en .gitignore - RIESGO DE SEGURIDAD');
            }
        } else {
            this.log('error', '.gitignore no encontrado');
        }

        // Verificar variables sensibles
        const envPath = path.join(__dirname, '.env');
        const envContent = fs.readFileSync(envPath, 'utf8');
        const sensitiveVars = ['JWT_SECRET', 'SESSION_SECRET', 'D360_API_KEY'];
        
        for (const varName of sensitiveVars) {
            const regex = new RegExp(`${varName}=(.+)`);
            const match = envContent.match(regex);
            if (match && match[1] && match[1].length > 10) {
                this.log('pass', `${varName} configurada y parece segura`);
            } else if (match) {
                this.log('warning', `${varName} configurada pero podría ser débil`);
            } else {
                this.log('error', `${varName} no configurada`);
            }
        }

        // Verificar HTTPS
        if (envContent.includes('HTTPS_ENABLED=true')) {
            this.log('pass', 'HTTPS habilitado');
        } else {
            this.log('warning', 'HTTPS no habilitado', 'Considera usar HTTPS en producción');
        }
    }

    async validateBackups() {
        console.log(`\n${colors.cyan}🧰 9. BACKUPS Y RESTAURACIÓN${colors.reset}`);

        const backupsDir = path.join(__dirname, 'backups');
        
        if (!fs.existsSync(backupsDir)) {
            this.log('error', 'Directorio de backups no existe');
            return;
        }

        const backupFiles = fs.readdirSync(backupsDir);
        const dbBackups = backupFiles.filter(f => f.includes('chatbot') && f.endsWith('.db'));
        
        this.log('info', `Total de backups encontrados: ${dbBackups.length}`);
        
        if (dbBackups.length > 0) {
            const latestBackup = dbBackups.sort().pop();
            const backupPath = path.join(backupsDir, latestBackup);
            const stats = fs.statSync(backupPath);
            const ageDays = (Date.now() - stats.mtime) / (1000 * 60 * 60 * 24);
            
            this.log('pass', `Último backup: ${latestBackup}`,
                `Antigüedad: ${ageDays.toFixed(1)} días`);
            
            if (ageDays > 7) {
                this.log('warning', 'Backup tiene más de 7 días', 
                    'Considera crear un backup más reciente');
            }
        } else {
            this.log('error', 'No hay backups de la base de datos');
        }

        // Crear backup actual si no existe uno de hoy
        const today = new Date().toISOString().split('T')[0];
        const todayBackup = `chatbot_${today}.db`;
        
        if (!backupFiles.includes(todayBackup)) {
            try {
                await execAsync(`cp data/database.sqlite backups/${todayBackup}`);
                this.log('pass', `Backup de hoy creado: ${todayBackup}`);
            } catch (error) {
                this.log('error', 'Error creando backup', error.message);
            }
        }
    }

    printSummary() {
        console.log(`\n${colors.blue}${'='.repeat(60)}${colors.reset}`);
        console.log(`${colors.blue}RESUMEN DE VALIDACIÓN${colors.reset}`);
        console.log(`${colors.blue}${'='.repeat(60)}${colors.reset}\n`);

        console.log(`${colors.green}✅ Pruebas Pasadas: ${this.results.passed.length}${colors.reset}`);
        console.log(`${colors.yellow}⚠️  Advertencias: ${this.results.warnings.length}${colors.reset}`);
        console.log(`${colors.red}❌ Errores: ${this.results.errors.length}${colors.reset}`);
        console.log(`${colors.cyan}ℹ️  Información: ${this.results.info.length}${colors.reset}`);

        const totalTests = this.results.passed.length + this.results.errors.length;
        const successRate = totalTests > 0 ? 
            (this.results.passed.length / totalTests * 100).toFixed(1) : 0;

        console.log(`\n${colors.blue}Tasa de Éxito: ${successRate}%${colors.reset}`);

        if (this.results.errors.length > 0) {
            console.log(`\n${colors.red}ERRORES CRÍTICOS A RESOLVER:${colors.reset}`);
            this.results.errors.forEach((error, index) => {
                console.log(`  ${index + 1}. ${error}`);
            });
        }

        if (this.results.warnings.length > 0) {
            console.log(`\n${colors.yellow}ADVERTENCIAS A REVISAR:${colors.reset}`);
            this.results.warnings.slice(0, 5).forEach((warning, index) => {
                console.log(`  ${index + 1}. ${warning}`);
            });
            if (this.results.warnings.length > 5) {
                console.log(`  ... y ${this.results.warnings.length - 5} más`);
            }
        }

        // Estado final
        console.log(`\n${colors.blue}${'='.repeat(60)}${colors.reset}`);
        
        if (this.results.errors.length === 0) {
            console.log(`${colors.green}🎉 SISTEMA LISTO PARA DEPLOY${colors.reset}`);
            console.log(`${colors.green}Todos los componentes críticos están funcionando correctamente${colors.reset}`);
        } else if (this.results.errors.length <= 3) {
            console.log(`${colors.yellow}⚠️ SISTEMA CASI LISTO${colors.reset}`);
            console.log(`${colors.yellow}Corrige los ${this.results.errors.length} errores antes del deploy${colors.reset}`);
        } else {
            console.log(`${colors.red}❌ SISTEMA NO ESTÁ LISTO PARA DEPLOY${colors.reset}`);
            console.log(`${colors.red}Se encontraron ${this.results.errors.length} errores críticos que deben resolverse${colors.reset}`);
        }

        console.log(`\n${colors.cyan}Fecha de validación: ${new Date().toLocaleString()}${colors.reset}`);
        
        // Guardar reporte
        const report = {
            date: new Date().toISOString(),
            results: this.results,
            successRate,
            ready: this.results.errors.length === 0
        };

        fs.writeFileSync(
            path.join(__dirname, 'validation-report.json'),
            JSON.stringify(report, null, 2)
        );
        
        console.log(`${colors.cyan}Reporte guardado en: validation-report.json${colors.reset}`);
    }
}

// Ejecutar validación
const validator = new SystemValidator();
validator.validate().catch(error => {
    console.error(`${colors.red}Error ejecutando validación:${colors.reset}`, error);
    process.exit(1);
});

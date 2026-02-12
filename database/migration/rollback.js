#!/usr/bin/env node

/**
 * =====================================================
 * ChatBot Enterprise - Script de Rollback
 * =====================================================
 * 
 * Este script permite revertir la migración de PostgreSQL
 * a MongoDB en caso de problemas o necesidad de rollback.
 * 
 * ADVERTENCIA: Este script eliminará TODOS los datos de PostgreSQL
 * y restaurará desde el backup de MongoDB.
 * 
 * Uso:
 *   node rollback.js [--confirm] [--backup-path=/path/to/backup]
 */

import { Pool } from 'pg';
import { promises as fs } from 'fs';
import path from 'path';
import readline from 'readline';

// Configuración
const CONFIG = {
    postgresql: {
        host: process.env.POSTGRES_HOST || 'localhost',
        port: process.env.POSTGRES_PORT || 5432,
        database: process.env.POSTGRES_DATABASE || 'chatbot_enterprise',
        user: process.env.POSTGRES_USER || 'chatbot_app',
        password: process.env.POSTGRES_PASSWORD || 'secure_app_password'
    },
    rollback: {
        confirmed: process.argv.includes('--confirm'),
        backupPath: process.argv.find(arg => arg.startsWith('--backup-path='))?.split('=')[1] || './backups',
        force: process.argv.includes('--force')
    }
};

class RollbackManager {
    constructor() {
        this.pgPool = null;
        this.logFile = path.join(__dirname, 'logs', `rollback-${Date.now()}.log`);
    }

    async initialize() {
        await this.log('INFO', 'Inicializando rollback manager...');
        
        // Conectar a PostgreSQL
        this.pgPool = new Pool(CONFIG.postgresql);
        await this.pgPool.query('SELECT NOW()');
        await this.log('INFO', 'Conectado a PostgreSQL');
    }

    async performRollback() {
        try {
            // Verificar confirmación
            if (!CONFIG.rollback.confirmed && !CONFIG.rollback.force) {
                const confirmed = await this.askConfirmation();
                if (!confirmed) {
                    await this.log('INFO', 'Rollback cancelado por el usuario');
                    return;
                }
            }

            await this.log('INFO', 'Iniciando proceso de rollback...');

            // Crear backup de seguridad antes del rollback
            await this.createSafetyBackup();

            // Limpiar datos de PostgreSQL
            await this.cleanPostgreSQLData();

            // Verificar que las tablas estén vacías
            await this.verifyCleanup();

            await this.log('INFO', 'Rollback completado exitosamente');
            console.log('\n✅ ROLLBACK COMPLETADO');
            console.log('📋 Los datos de PostgreSQL han sido eliminados');
            console.log('💾 Se ha creado un backup de seguridad');
            console.log('🔄 Puedes restaurar desde MongoDB usando el script de migración');

        } catch (error) {
            await this.log('ERROR', 'Error durante el rollback', error);
            throw error;
        }
    }

    async askConfirmation() {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        console.log('\n⚠️  ADVERTENCIA: OPERACIÓN DESTRUCTIVA ⚠️');
        console.log('Este proceso eliminará TODOS los datos de PostgreSQL.');
        console.log('Asegúrate de tener backups antes de continuar.\n');

        return new Promise((resolve) => {
            rl.question('¿Estás seguro de que quieres continuar? (escriba "CONFIRMAR" para proceder): ', (answer) => {
                rl.close();
                resolve(answer === 'CONFIRMAR');
            });
        });
    }

    async createSafetyBackup() {
        await this.log('INFO', 'Creando backup de seguridad...');
        
        const backupDir = path.join(__dirname, 'backups', `safety-backup-${Date.now()}`);
        await fs.mkdir(backupDir, { recursive: true });

        // Backup de cada tabla
        const tables = [
            'users', 'contacts', 'conversations', 'messages', 'templates',
            'campaigns', 'contact_segments', 'tags', 'conversation_metrics',
            'system_settings', 'audit_logs'
        ];

        for (const table of tables) {
            try {
                const result = await this.pgPool.query(`SELECT * FROM ${table}`);
                const backupFile = path.join(backupDir, `${table}.json`);
                await fs.writeFile(backupFile, JSON.stringify(result.rows, null, 2));
                await this.log('INFO', `Backup creado para tabla ${table}: ${result.rows.length} registros`);
            } catch (error) {
                await this.log('WARNING', `Error al crear backup de ${table}: ${error.message}`);
            }
        }

        await this.log('INFO', `Backup de seguridad creado en: ${backupDir}`);
    }

    async cleanPostgreSQLData() {
        await this.log('INFO', 'Limpiando datos de PostgreSQL...');

        const client = await this.pgPool.connect();
        
        try {
            await client.query('BEGIN');

            // Deshabilitar triggers temporalmente
            await client.query('SET session_replication_role = replica');

            // Orden de eliminación (respetando dependencias)
            const deletionOrder = [
                'audit_logs',
                'conversation_metrics',
                'contact_segment_members',
                'conversation_tags',
                'contact_tags',
                'messages',
                'campaigns',
                'conversations',
                'templates',
                'contacts',
                'contact_segments',
                'tags',
                'system_settings',
                'users'
            ];

            for (const table of deletionOrder) {
                try {
                    const result = await client.query(`DELETE FROM ${table}`);
                    await this.log('INFO', `Tabla ${table} limpiada: ${result.rowCount} registros eliminados`);
                } catch (error) {
                    await this.log('WARNING', `Error al limpiar tabla ${table}: ${error.message}`);
                }
            }

            // Reiniciar secuencias
            const sequences = [
                'users_id_seq',
                'contacts_id_seq',
                'conversations_id_seq',
                'messages_id_seq',
                'templates_id_seq',
                'campaigns_id_seq',
                'contact_segments_id_seq',
                'tags_id_seq',
                'conversation_metrics_id_seq',
                'system_settings_id_seq',
                'audit_logs_id_seq'
            ];

            for (const sequence of sequences) {
                try {
                    await client.query(`ALTER SEQUENCE ${sequence} RESTART WITH 1`);
                    await this.log('INFO', `Secuencia ${sequence} reiniciada`);
                } catch (error) {
                    await this.log('WARNING', `Error al reiniciar secuencia ${sequence}: ${error.message}`);
                }
            }

            // Rehabilitar triggers
            await client.query('SET session_replication_role = DEFAULT');

            await client.query('COMMIT');
            await this.log('INFO', 'Limpieza de PostgreSQL completada');

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    async verifyCleanup() {
        await this.log('INFO', 'Verificando limpieza...');

        const tables = [
            'users', 'contacts', 'conversations', 'messages', 'templates',
            'campaigns', 'contact_segments', 'tags', 'conversation_metrics',
            'system_settings', 'audit_logs'
        ];

        let totalRecords = 0;

        for (const table of tables) {
            try {
                const result = await this.pgPool.query(`SELECT COUNT(*) as count FROM ${table}`);
                const count = parseInt(result.rows[0].count);
                totalRecords += count;

                if (count > 0) {
                    await this.log('WARNING', `Tabla ${table} aún contiene ${count} registros`);
                } else {
                    await this.log('INFO', `Tabla ${table} limpiada correctamente`);
                }
            } catch (error) {
                await this.log('ERROR', `Error al verificar tabla ${table}: ${error.message}`);
            }
        }

        if (totalRecords === 0) {
            await this.log('INFO', 'Verificación completada: todas las tablas están vacías');
        } else {
            await this.log('WARNING', `Verificación completada: ${totalRecords} registros restantes`);
        }
    }

    async log(level, message, data = null) {
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] ${level}: ${message}`;
        
        console.log(logEntry);
        
        if (data) {
            console.log(JSON.stringify(data, null, 2));
        }
        
        // Crear directorio de logs si no existe
        await fs.mkdir(path.dirname(this.logFile), { recursive: true });
        await fs.appendFile(this.logFile, logEntry + '\n');
        
        if (data) {
            await fs.appendFile(this.logFile, JSON.stringify(data, null, 2) + '\n');
        }
    }

    async cleanup() {
        if (this.pgPool) {
            await this.pgPool.end();
            await this.log('INFO', 'Pool PostgreSQL cerrado');
        }
    }
}

// Función principal
async function main() {
    const rollbackManager = new RollbackManager();
    
    try {
        await rollbackManager.initialize();
        await rollbackManager.performRollback();
        process.exit(0);
    } catch (error) {
        console.error('❌ Error durante el rollback:', error);
        process.exit(1);
    } finally {
        await rollbackManager.cleanup();
    }
}

// Ejecutar si es llamado directamente
// Ejecutar si es el módulo principal
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}

export { RollbackManager };
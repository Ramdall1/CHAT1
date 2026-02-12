#!/usr/bin/env node

/**
 * =====================================================
 * ChatBot Enterprise - Validador de Migración
 * =====================================================
 * 
 * Este script valida que la migración de MongoDB a PostgreSQL
 * se haya completado correctamente, verificando:
 * - Conteos de registros
 * - Integridad referencial
 * - Consistencia de datos
 * - Índices y constraints
 * 
 * Uso:
 *   node validate-migration.js [--detailed] [--fix-issues]
 */

import { MongoClient } from 'mongodb';
import { Pool } from 'pg';
import { promises as fs } from 'fs';
import path from 'path';

// Configuración (reutilizar del script principal)
const CONFIG = {
    mongodb: {
        url: process.env.MONGODB_URL || 'mongodb://localhost:27017',
        database: process.env.MONGODB_DATABASE || 'chatbot_enterprise'
    },
    postgresql: {
        host: process.env.POSTGRES_HOST || 'localhost',
        port: process.env.POSTGRES_PORT || 5432,
        database: process.env.POSTGRES_DATABASE || 'chatbot_enterprise',
        user: process.env.POSTGRES_USER || 'chatbot_app',
        password: process.env.POSTGRES_PASSWORD || 'secure_app_password'
    },
    validation: {
        detailed: process.argv.includes('--detailed'),
        fixIssues: process.argv.includes('--fix-issues')
    }
};

class MigrationValidator {
    constructor() {
        this.mongoClient = null;
        this.pgPool = null;
        this.issues = [];
        this.stats = {
            startTime: new Date(),
            collections: {},
            totalIssues: 0,
            criticalIssues: 0
        };
    }

    async initialize() {
        console.log('🔍 Inicializando validador de migración...');
        
        // Conectar a MongoDB
        this.mongoClient = new MongoClient(CONFIG.mongodb.url);
        await this.mongoClient.connect();
        console.log('✅ Conectado a MongoDB');
        
        // Conectar a PostgreSQL
        this.pgPool = new Pool(CONFIG.postgresql);
        await this.pgPool.query('SELECT NOW()');
        console.log('✅ Conectado a PostgreSQL');
    }

    async validateMigration() {
        console.log('\n📊 Iniciando validación de migración...\n');
        
        try {
            // Validaciones principales
            await this.validateRecordCounts();
            await this.validateDataIntegrity();
            await this.validateReferentialIntegrity();
            await this.validateIndexes();
            await this.validateConstraints();
            
            if (CONFIG.validation.detailed) {
                await this.validateDataConsistency();
                await this.validatePerformance();
            }
            
            await this.generateReport();
            
        } catch (error) {
            console.error('❌ Error durante la validación:', error);
            throw error;
        }
    }

    async validateRecordCounts() {
        console.log('📋 Validando conteos de registros...');
        
        const collections = ['users', 'contacts', 'conversations', 'messages', 'templates'];
        const db = this.mongoClient.db(CONFIG.mongodb.database);
        
        for (const collection of collections) {
            try {
                const mongoCount = await db.collection(collection).countDocuments();
                
                const tableName = this.getTableName(collection);
                const pgResult = await this.pgPool.query(`SELECT COUNT(*) as count FROM ${tableName}`);
                const pgCount = parseInt(pgResult.rows[0].count);
                
                this.stats.collections[collection] = {
                    mongodb: mongoCount,
                    postgresql: pgCount,
                    difference: Math.abs(mongoCount - pgCount)
                };
                
                if (mongoCount !== pgCount) {
                    this.addIssue('critical', 'count_mismatch', 
                        `Diferencia en conteo de ${collection}: MongoDB=${mongoCount}, PostgreSQL=${pgCount}`);
                } else {
                    console.log(`  ✅ ${collection}: ${mongoCount} registros`);
                }
                
            } catch (error) {
                this.addIssue('critical', 'count_error', 
                    `Error al contar registros de ${collection}: ${error.message}`);
            }
        }
    }

    async validateDataIntegrity() {
        console.log('\n🔍 Validando integridad de datos...');
        
        // Validar usuarios
        await this.validateUsersIntegrity();
        
        // Validar contactos
        await this.validateContactsIntegrity();
        
        // Validar conversaciones
        await this.validateConversationsIntegrity();
        
        // Validar mensajes
        await this.validateMessagesIntegrity();
    }

    async validateUsersIntegrity() {
        const issues = await this.pgPool.query(`
            SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN email IS NULL OR email = '' THEN 1 END) as missing_email,
                COUNT(CASE WHEN password IS NULL OR password = '' THEN 1 END) as missing_password,
                COUNT(CASE WHEN email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$' THEN 1 END) as invalid_email,
                COUNT(CASE WHEN phone IS NOT NULL AND phone !~ '^\\+[1-9]\\d{1,14}$' THEN 1 END) as invalid_phone
            FROM users
        `);
        
        const stats = issues.rows[0];
        
        if (parseInt(stats.missing_email) > 0) {
            this.addIssue('critical', 'data_integrity', `${stats.missing_email} usuarios sin email`);
        }
        
        if (parseInt(stats.missing_password) > 0) {
            this.addIssue('critical', 'data_integrity', `${stats.missing_password} usuarios sin password`);
        }
        
        if (parseInt(stats.invalid_email) > 0) {
            this.addIssue('warning', 'data_integrity', `${stats.invalid_email} usuarios con email inválido`);
        }
        
        if (parseInt(stats.invalid_phone) > 0) {
            this.addIssue('warning', 'data_integrity', `${stats.invalid_phone} usuarios con teléfono inválido`);
        }
        
        console.log(`  ✅ Usuarios: ${stats.total} validados`);
    }

    async validateContactsIntegrity() {
        const issues = await this.pgPool.query(`
            SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN name IS NULL OR name = '' THEN 1 END) as missing_name,
                COUNT(CASE WHEN phone IS NULL OR phone = '' THEN 1 END) as missing_phone,
                COUNT(CASE WHEN phone !~ '^\\+[1-9]\\d{1,14}$' THEN 1 END) as invalid_phone,
                COUNT(CASE WHEN email IS NOT NULL AND email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$' THEN 1 END) as invalid_email
            FROM contacts
        `);
        
        const stats = issues.rows[0];
        
        if (parseInt(stats.missing_name) > 0) {
            this.addIssue('critical', 'data_integrity', `${stats.missing_name} contactos sin nombre`);
        }
        
        if (parseInt(stats.missing_phone) > 0) {
            this.addIssue('critical', 'data_integrity', `${stats.missing_phone} contactos sin teléfono`);
        }
        
        if (parseInt(stats.invalid_phone) > 0) {
            this.addIssue('critical', 'data_integrity', `${stats.invalid_phone} contactos con teléfono inválido`);
        }
        
        if (parseInt(stats.invalid_email) > 0) {
            this.addIssue('warning', 'data_integrity', `${stats.invalid_email} contactos con email inválido`);
        }
        
        console.log(`  ✅ Contactos: ${stats.total} validados`);
    }

    async validateConversationsIntegrity() {
        const issues = await this.pgPool.query(`
            SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN contact_id IS NULL THEN 1 END) as missing_contact,
                COUNT(CASE WHEN channel IS NULL OR channel = '' THEN 1 END) as missing_channel,
                COUNT(CASE WHEN status IS NULL OR status = '' THEN 1 END) as missing_status
            FROM conversations
        `);
        
        const stats = issues.rows[0];
        
        if (parseInt(stats.missing_contact) > 0) {
            this.addIssue('critical', 'data_integrity', `${stats.missing_contact} conversaciones sin contacto`);
        }
        
        if (parseInt(stats.missing_channel) > 0) {
            this.addIssue('critical', 'data_integrity', `${stats.missing_channel} conversaciones sin canal`);
        }
        
        if (parseInt(stats.missing_status) > 0) {
            this.addIssue('critical', 'data_integrity', `${stats.missing_status} conversaciones sin estado`);
        }
        
        console.log(`  ✅ Conversaciones: ${stats.total} validadas`);
    }

    async validateMessagesIntegrity() {
        const issues = await this.pgPool.query(`
            SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN conversation_id IS NULL THEN 1 END) as missing_conversation,
                COUNT(CASE WHEN content IS NULL OR content = '' THEN 1 END) as missing_content,
                COUNT(CASE WHEN direction IS NULL OR direction = '' THEN 1 END) as missing_direction
            FROM messages
        `);
        
        const stats = issues.rows[0];
        
        if (parseInt(stats.missing_conversation) > 0) {
            this.addIssue('critical', 'data_integrity', `${stats.missing_conversation} mensajes sin conversación`);
        }
        
        if (parseInt(stats.missing_content) > 0) {
            this.addIssue('critical', 'data_integrity', `${stats.missing_content} mensajes sin contenido`);
        }
        
        if (parseInt(stats.missing_direction) > 0) {
            this.addIssue('critical', 'data_integrity', `${stats.missing_direction} mensajes sin dirección`);
        }
        
        console.log(`  ✅ Mensajes: ${stats.total} validados`);
    }

    async validateReferentialIntegrity() {
        console.log('\n🔗 Validando integridad referencial...');
        
        // Validar referencias de conversaciones a contactos
        const orphanConversations = await this.pgPool.query(`
            SELECT COUNT(*) as count
            FROM conversations c
            LEFT JOIN contacts cont ON c.contact_id = cont.id
            WHERE cont.id IS NULL
        `);
        
        if (parseInt(orphanConversations.rows[0].count) > 0) {
            this.addIssue('critical', 'referential_integrity', 
                `${orphanConversations.rows[0].count} conversaciones huérfanas (sin contacto válido)`);
        }
        
        // Validar referencias de mensajes a conversaciones
        const orphanMessages = await this.pgPool.query(`
            SELECT COUNT(*) as count
            FROM messages m
            LEFT JOIN conversations c ON m.conversation_id = c.id
            WHERE c.id IS NULL
        `);
        
        if (parseInt(orphanMessages.rows[0].count) > 0) {
            this.addIssue('critical', 'referential_integrity', 
                `${orphanMessages.rows[0].count} mensajes huérfanos (sin conversación válida)`);
        }
        
        // Validar referencias de conversaciones a usuarios asignados
        const invalidAssignments = await this.pgPool.query(`
            SELECT COUNT(*) as count
            FROM conversations c
            LEFT JOIN users u ON c.assigned_to = u.id
            WHERE c.assigned_to IS NOT NULL AND u.id IS NULL
        `);
        
        if (parseInt(invalidAssignments.rows[0].count) > 0) {
            this.addIssue('warning', 'referential_integrity', 
                `${invalidAssignments.rows[0].count} conversaciones asignadas a usuarios inexistentes`);
        }
        
        console.log('  ✅ Integridad referencial validada');
    }

    async validateIndexes() {
        console.log('\n📇 Validando índices...');
        
        const expectedIndexes = [
            'idx_users_email',
            'idx_contacts_phone',
            'idx_conversations_contact_id',
            'idx_messages_conversation_id',
            'idx_messages_timestamp'
        ];
        
        for (const indexName of expectedIndexes) {
            const result = await this.pgPool.query(`
                SELECT indexname 
                FROM pg_indexes 
                WHERE indexname = $1
            `, [indexName]);
            
            if (result.rows.length === 0) {
                this.addIssue('warning', 'missing_index', `Índice faltante: ${indexName}`);
            }
        }
        
        console.log('  ✅ Índices validados');
    }

    async validateConstraints() {
        console.log('\n🔒 Validando constraints...');
        
        // Validar constraints de email
        const emailConstraints = await this.pgPool.query(`
            SELECT COUNT(*) as violations
            FROM users 
            WHERE email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$'
        `);
        
        if (parseInt(emailConstraints.rows[0].violations) > 0) {
            this.addIssue('critical', 'constraint_violation', 
                `${emailConstraints.rows[0].violations} violaciones de constraint de email`);
        }
        
        // Validar constraints de teléfono
        const phoneConstraints = await this.pgPool.query(`
            SELECT COUNT(*) as violations
            FROM contacts 
            WHERE phone !~ '^\\+[1-9]\\d{1,14}$'
        `);
        
        if (parseInt(phoneConstraints.rows[0].violations) > 0) {
            this.addIssue('critical', 'constraint_violation', 
                `${phoneConstraints.rows[0].violations} violaciones de constraint de teléfono`);
        }
        
        console.log('  ✅ Constraints validados');
    }

    async validateDataConsistency() {
        console.log('\n🔄 Validando consistencia de datos...');
        
        // Comparar algunos registros específicos entre MongoDB y PostgreSQL
        const db = this.mongoClient.db(CONFIG.mongodb.database);
        
        // Validar usuarios
        const mongoUsers = await db.collection('users').find({}).limit(10).toArray();
        for (const mongoUser of mongoUsers) {
            const pgUser = await this.pgPool.query(
                'SELECT * FROM users WHERE email = $1', 
                [mongoUser.email]
            );
            
            if (pgUser.rows.length === 0) {
                this.addIssue('warning', 'data_consistency', 
                    `Usuario ${mongoUser.email} existe en MongoDB pero no en PostgreSQL`);
            }
        }
        
        console.log('  ✅ Consistencia de datos validada');
    }

    async validatePerformance() {
        console.log('\n⚡ Validando rendimiento...');
        
        // Probar consultas comunes
        const queries = [
            'SELECT COUNT(*) FROM users WHERE is_active = true',
            'SELECT COUNT(*) FROM conversations WHERE status = \'active\'',
            'SELECT COUNT(*) FROM messages WHERE timestamp > NOW() - INTERVAL \'1 day\'',
            'SELECT c.*, cont.name FROM conversations c JOIN contacts cont ON c.contact_id = cont.id LIMIT 100'
        ];
        
        for (const query of queries) {
            const start = Date.now();
            await this.pgPool.query(query);
            const duration = Date.now() - start;
            
            if (duration > 1000) {
                this.addIssue('warning', 'performance', 
                    `Consulta lenta (${duration}ms): ${query.substring(0, 50)}...`);
            }
        }
        
        console.log('  ✅ Rendimiento validado');
    }

    async generateReport() {
        this.stats.endTime = new Date();
        this.stats.duration = this.stats.endTime - this.stats.startTime;
        this.stats.totalIssues = this.issues.length;
        this.stats.criticalIssues = this.issues.filter(i => i.severity === 'critical').length;
        
        const reportPath = path.join(__dirname, 'logs', `validation-report-${Date.now()}.json`);
        await fs.mkdir(path.dirname(reportPath), { recursive: true });
        
        const report = {
            timestamp: new Date().toISOString(),
            stats: this.stats,
            issues: this.issues,
            summary: {
                totalCollections: Object.keys(this.stats.collections).length,
                totalIssues: this.stats.totalIssues,
                criticalIssues: this.stats.criticalIssues,
                warningIssues: this.stats.totalIssues - this.stats.criticalIssues,
                migrationStatus: this.stats.criticalIssues === 0 ? 'SUCCESS' : 'ISSUES_FOUND'
            }
        };
        
        await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
        
        // Mostrar resumen en consola
        console.log('\n' + '='.repeat(60));
        console.log('📊 RESUMEN DE VALIDACIÓN');
        console.log('='.repeat(60));
        console.log(`⏱️  Duración: ${Math.round(this.stats.duration / 1000)} segundos`);
        console.log(`📋 Colecciones validadas: ${Object.keys(this.stats.collections).length}`);
        console.log(`⚠️  Issues encontrados: ${this.stats.totalIssues}`);
        console.log(`🚨 Issues críticos: ${this.stats.criticalIssues}`);
        console.log(`📄 Reporte guardado en: ${reportPath}`);
        
        if (this.stats.criticalIssues === 0) {
            console.log('\n✅ MIGRACIÓN VALIDADA EXITOSAMENTE');
        } else {
            console.log('\n❌ SE ENCONTRARON ISSUES CRÍTICOS');
            console.log('\nIssues críticos:');
            this.issues
                .filter(i => i.severity === 'critical')
                .forEach(issue => console.log(`  🚨 ${issue.message}`));
        }
        
        console.log('\nConteos por colección:');
        Object.entries(this.stats.collections).forEach(([collection, stats]) => {
            const status = stats.difference === 0 ? '✅' : '❌';
            console.log(`  ${status} ${collection}: MongoDB=${stats.mongodb}, PostgreSQL=${stats.postgresql}`);
        });
        
        return report;
    }

    addIssue(severity, type, message) {
        this.issues.push({
            timestamp: new Date(),
            severity,
            type,
            message
        });
    }

    getTableName(collection) {
        const mapping = {
            'users': 'users',
            'contacts': 'contacts',
            'conversations': 'conversations',
            'messages': 'messages',
            'templates': 'templates'
        };
        return mapping[collection] || collection;
    }

    async cleanup() {
        if (this.mongoClient) {
            await this.mongoClient.close();
        }
        
        if (this.pgPool) {
            await this.pgPool.end();
        }
    }
}

// Función principal
async function main() {
    const validator = new MigrationValidator();
    
    try {
        await validator.initialize();
        const report = await validator.validateMigration();
        
        // Exit code basado en el resultado
        process.exit(report.summary.criticalIssues > 0 ? 1 : 0);
        
    } catch (error) {
        console.error('❌ Error durante la validación:', error);
        process.exit(1);
    } finally {
        await validator.cleanup();
    }
}

// Ejecutar si es llamado directamente
// Ejecutar si es el módulo principal
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}

export { MigrationValidator };
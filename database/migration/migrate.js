#!/usr/bin/env node

/**
 * =====================================================
 * ChatBot Enterprise - Script de Migración Principal
 * MongoDB a PostgreSQL
 * =====================================================
 * 
 * Este script coordina la migración completa de datos
 * desde MongoDB hacia PostgreSQL, manteniendo la
 * integridad referencial y optimizando el rendimiento.
 * 
 * Uso:
 *   node migrate.js [--dry-run] [--batch-size=1000] [--collection=users]
 * 
 * Opciones:
 *   --dry-run: Simula la migración sin escribir datos
 *   --batch-size: Tamaño del lote para procesamiento (default: 1000)
 *   --collection: Migrar solo una colección específica
 *   --skip-validation: Omitir validación de datos
 *   --continue-on-error: Continuar migración aunque haya errores
 */

import { MongoClient } from 'mongodb';
import { Pool } from 'pg';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import bcrypt from 'bcrypt';

// Configuración
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
    migration: {
        batchSize: parseInt(process.env.BATCH_SIZE) || 1000,
        dryRun: process.argv.includes('--dry-run'),
        skipValidation: process.argv.includes('--skip-validation'),
        continueOnError: process.argv.includes('--continue-on-error'),
        targetCollection: process.argv.find(arg => arg.startsWith('--collection='))?.split('=')[1]
    }
};

// Orden de migración (respetando dependencias)
const MIGRATION_ORDER = [
    'users',
    'tags', 
    'contact_segments',
    'contacts',
    'templates',
    'conversations',
    'messages',
    'campaigns',
    'conversation_metrics',
    'system_settings',
    'audit_logs'
];

// Mapeo de colecciones MongoDB a tablas PostgreSQL
const COLLECTION_MAPPING = {
    'users': 'users',
    'contacts': 'contacts', 
    'conversations': 'conversations',
    'messages': 'messages',
    'templates': 'templates',
    'campaigns': 'campaigns',
    'segments': 'contact_segments',
    'tags': 'tags',
    'metrics': 'conversation_metrics',
    'settings': 'system_settings',
    'audit': 'audit_logs'
};

class MigrationLogger {
    constructor() {
        this.logFile = path.join(__dirname, 'logs', `migration-${Date.now()}.log`);
        this.stats = {
            startTime: new Date(),
            collections: {},
            errors: [],
            warnings: []
        };
    }

    async init() {
        await fs.mkdir(path.dirname(this.logFile), { recursive: true });
        await this.log('INFO', 'Iniciando migración de MongoDB a PostgreSQL');
    }

    async log(level, message, data = null) {
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] ${level}: ${message}`;
        
        console.log(logEntry);
        
        if (data) {
            console.log(JSON.stringify(data, null, 2));
        }
        
        await fs.appendFile(this.logFile, logEntry + '\n');
        
        if (data) {
            await fs.appendFile(this.logFile, JSON.stringify(data, null, 2) + '\n');
        }
    }

    updateStats(collection, operation, count = 1) {
        if (!this.stats.collections[collection]) {
            this.stats.collections[collection] = {
                processed: 0,
                errors: 0,
                warnings: 0
            };
        }
        
        this.stats.collections[collection][operation] += count;
    }

    addError(error, context = '') {
        this.stats.errors.push({
            timestamp: new Date(),
            error: error.message,
            context,
            stack: error.stack
        });
    }

    addWarning(message, context = '') {
        this.stats.warnings.push({
            timestamp: new Date(),
            message,
            context
        });
    }

    async generateReport() {
        this.stats.endTime = new Date();
        this.stats.duration = this.stats.endTime - this.stats.startTime;
        
        const reportPath = path.join(__dirname, 'logs', `migration-report-${Date.now()}.json`);
        await fs.writeFile(reportPath, JSON.stringify(this.stats, null, 2));
        
        await this.log('INFO', `Reporte de migración generado: ${reportPath}`);
        return this.stats;
    }
}

class DataValidator {
    static validateUser(user) {
        const errors = [];
        
        if (!user.email || !this.isValidEmail(user.email)) {
            errors.push('Email inválido o faltante');
        }
        
        if (!user.password) {
            errors.push('Password faltante');
        }
        
        if (user.phone && !this.isValidPhone(user.phone)) {
            errors.push('Formato de teléfono inválido');
        }
        
        return errors;
    }

    static validateContact(contact) {
        const errors = [];
        
        if (!contact.name || contact.name.trim().length === 0) {
            errors.push('Nombre faltante o vacío');
        }
        
        if (!contact.phone || !this.isValidPhone(contact.phone)) {
            errors.push('Teléfono inválido o faltante');
        }
        
        if (contact.email && !this.isValidEmail(contact.email)) {
            errors.push('Email inválido');
        }
        
        return errors;
    }

    static validateConversation(conversation) {
        const errors = [];
        
        if (!conversation.contactId && !conversation.contact_id) {
            errors.push('ID de contacto faltante');
        }
        
        if (!conversation.channel) {
            errors.push('Canal de conversación faltante');
        }
        
        return errors;
    }

    static validateMessage(message) {
        const errors = [];
        
        if (!message.conversationId && !message.conversation_id) {
            errors.push('ID de conversación faltante');
        }
        
        if (!message.content || message.content.trim().length === 0) {
            errors.push('Contenido del mensaje vacío');
        }
        
        if (!message.direction) {
            errors.push('Dirección del mensaje faltante');
        }
        
        return errors;
    }

    static isValidEmail(email) {
        const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
        return emailRegex.test(email);
    }

    static isValidPhone(phone) {
        const phoneRegex = /^\+[1-9]\d{1,14}$/;
        return phoneRegex.test(phone);
    }
}

class DataTransformer {
    static transformUser(mongoUser) {
        return {
            uuid: mongoUser.uuid || this.generateUUID(),
            email: mongoUser.email,
            password: mongoUser.password,
            role: mongoUser.role || 'user',
            is_active: mongoUser.isActive !== false,
            first_name: mongoUser.firstName || mongoUser.name?.split(' ')[0] || null,
            last_name: mongoUser.lastName || mongoUser.name?.split(' ').slice(1).join(' ') || null,
            phone: mongoUser.phone || null,
            avatar_url: mongoUser.avatarUrl || mongoUser.avatar || null,
            last_login: mongoUser.lastLogin ? new Date(mongoUser.lastLogin) : null,
            permissions: JSON.stringify(mongoUser.permissions || []),
            settings: JSON.stringify(mongoUser.settings || {}),
            created_at: mongoUser.createdAt ? new Date(mongoUser.createdAt) : new Date(),
            updated_at: mongoUser.updatedAt ? new Date(mongoUser.updatedAt) : new Date()
        };
    }

    static transformContact(mongoContact) {
        return {
            uuid: mongoContact.uuid || this.generateUUID(),
            name: mongoContact.name,
            phone: mongoContact.phone,
            email: mongoContact.email || null,
            status: mongoContact.status || 'active',
            tags: JSON.stringify(mongoContact.tags || []),
            custom_fields: JSON.stringify(mongoContact.customFields || mongoContact.metadata || {}),
            notes: mongoContact.notes || null,
            last_interaction: mongoContact.lastInteraction ? new Date(mongoContact.lastInteraction) : null,
            source: mongoContact.source || null,
            created_at: mongoContact.createdAt ? new Date(mongoContact.createdAt) : new Date(),
            updated_at: mongoContact.updatedAt ? new Date(mongoContact.updatedAt) : new Date()
        };
    }

    static transformConversation(mongoConversation) {
        return {
            uuid: mongoConversation.uuid || this.generateUUID(),
            contact_id: mongoConversation.contactId || mongoConversation.contact_id,
            user_id: mongoConversation.userId || mongoConversation.user_id || null,
            channel: mongoConversation.channel || 'web',
            status: mongoConversation.status || 'active',
            assigned_to: mongoConversation.assignedTo || mongoConversation.assigned_to || null,
            priority: mongoConversation.priority || 'medium',
            subject: mongoConversation.subject || null,
            tags: JSON.stringify(mongoConversation.tags || []),
            metadata: JSON.stringify(mongoConversation.metadata || {}),
            last_message_at: mongoConversation.lastMessageAt ? new Date(mongoConversation.lastMessageAt) : null,
            closed_at: mongoConversation.closedAt ? new Date(mongoConversation.closedAt) : null,
            resolution_time: mongoConversation.resolutionTime || null,
            satisfaction_score: mongoConversation.satisfactionScore || null,
            created_at: mongoConversation.createdAt ? new Date(mongoConversation.createdAt) : new Date(),
            updated_at: mongoConversation.updatedAt ? new Date(mongoConversation.updatedAt) : new Date()
        };
    }

    static transformMessage(mongoMessage) {
        return {
            uuid: mongoMessage.uuid || this.generateUUID(),
            conversation_id: mongoMessage.conversationId || mongoMessage.conversation_id,
            content: mongoMessage.content || mongoMessage.text || '',
            message_type: mongoMessage.type || mongoMessage.messageType || 'text',
            direction: mongoMessage.direction || 'inbound',
            sender_id: mongoMessage.senderId || mongoMessage.sender_id || null,
            external_id: mongoMessage.externalId || mongoMessage.external_id || null,
            media_url: mongoMessage.mediaUrl || mongoMessage.media?.url || null,
            media_type: mongoMessage.mediaType || mongoMessage.media?.type || null,
            media_size: mongoMessage.mediaSize || mongoMessage.media?.size || null,
            metadata: JSON.stringify(mongoMessage.metadata || {}),
            read_at: mongoMessage.readAt ? new Date(mongoMessage.readAt) : null,
            delivered_at: mongoMessage.deliveredAt ? new Date(mongoMessage.deliveredAt) : null,
            failed_at: mongoMessage.failedAt ? new Date(mongoMessage.failedAt) : null,
            error_message: mongoMessage.errorMessage || null,
            timestamp: mongoMessage.timestamp ? new Date(mongoMessage.timestamp) : new Date()
        };
    }

    static transformTemplate(mongoTemplate) {
        return {
            uuid: mongoTemplate.uuid || this.generateUUID(),
            name: mongoTemplate.name,
            content: mongoTemplate.content || mongoTemplate.body || '',
            category: mongoTemplate.category || 'utility',
            status: mongoTemplate.status || 'draft',
            language: mongoTemplate.language || 'es',
            variables: JSON.stringify(mongoTemplate.variables || []),
            header_type: mongoTemplate.header?.type || null,
            header_content: mongoTemplate.header?.content || null,
            footer_content: mongoTemplate.footer || null,
            buttons: JSON.stringify(mongoTemplate.buttons || []),
            usage_count: mongoTemplate.usageCount || 0,
            created_by: mongoTemplate.createdBy || mongoTemplate.created_by || null,
            approved_by: mongoTemplate.approvedBy || mongoTemplate.approved_by || null,
            approved_at: mongoTemplate.approvedAt ? new Date(mongoTemplate.approvedAt) : null,
            created_at: mongoTemplate.createdAt ? new Date(mongoTemplate.createdAt) : new Date(),
            updated_at: mongoTemplate.updatedAt ? new Date(mongoTemplate.updatedAt) : new Date()
        };
    }

    static generateUUID() {
        return crypto.randomUUID();
    }

    static normalizePhone(phone) {
        if (!phone) return null;
        
        // Remover espacios y caracteres especiales
        let normalized = phone.replace(/[\s\-\(\)]/g, '');
        
        // Agregar + si no lo tiene
        if (!normalized.startsWith('+')) {
            normalized = '+' + normalized;
        }
        
        return normalized;
    }

    static hashPassword(password) {
        if (password.startsWith('$2b$')) {
            return password; // Ya está hasheado
        }
        return bcrypt.hashSync(password, 12);
    }
}

class PostgreSQLMigrator {
    constructor(pgPool, logger) {
        this.pool = pgPool;
        this.logger = logger;
        this.idMappings = new Map(); // Para mapear IDs de MongoDB a PostgreSQL
    }

    async migrateCollection(collection, mongoData, transformer, validator) {
        const tableName = COLLECTION_MAPPING[collection] || collection;
        const batchSize = CONFIG.migration.batchSize;
        
        await this.logger.log('INFO', `Iniciando migración de ${collection} (${mongoData.length} registros)`);
        
        let processed = 0;
        let errors = 0;
        
        for (let i = 0; i < mongoData.length; i += batchSize) {
            const batch = mongoData.slice(i, i + batchSize);
            
            try {
                await this.processBatch(collection, tableName, batch, transformer, validator);
                processed += batch.length;
                
                await this.logger.log('INFO', `Procesados ${processed}/${mongoData.length} registros de ${collection}`);
                
            } catch (error) {
                errors += batch.length;
                this.logger.addError(error, `Lote ${i}-${i + batch.length} de ${collection}`);
                
                if (!CONFIG.migration.continueOnError) {
                    throw error;
                }
            }
        }
        
        this.logger.updateStats(collection, 'processed', processed);
        this.logger.updateStats(collection, 'errors', errors);
        
        await this.logger.log('INFO', `Migración de ${collection} completada: ${processed} procesados, ${errors} errores`);
    }

    async processBatch(collection, tableName, batch, transformer, validator) {
        const client = await this.pool.connect();
        
        try {
            await client.query('BEGIN');
            
            for (const item of batch) {
                try {
                    // Validar datos si no se omite la validación
                    if (!CONFIG.migration.skipValidation && validator) {
                        const validationErrors = validator(item);
                        if (validationErrors.length > 0) {
                            this.logger.addWarning(`Errores de validación en ${collection}: ${validationErrors.join(', ')}`, item._id);
                            continue;
                        }
                    }
                    
                    // Transformar datos
                    const transformedData = transformer(item);
                    
                    // Insertar en PostgreSQL
                    if (!CONFIG.migration.dryRun) {
                        const result = await this.insertRecord(client, tableName, transformedData);
                        
                        // Guardar mapeo de IDs
                        if (result && result.rows[0]) {
                            this.idMappings.set(`${collection}:${item._id}`, result.rows[0].id);
                        }
                    }
                    
                } catch (error) {
                    this.logger.addError(error, `Registro ${item._id} de ${collection}`);
                    
                    if (!CONFIG.migration.continueOnError) {
                        throw error;
                    }
                }
            }
            
            await client.query('COMMIT');
            
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    async insertRecord(client, tableName, data) {
        const columns = Object.keys(data);
        const values = Object.values(data);
        const placeholders = values.map((_, index) => `$${index + 1}`);
        
        const query = `
            INSERT INTO ${tableName} (${columns.join(', ')})
            VALUES (${placeholders.join(', ')})
            RETURNING id
        `;
        
        return await client.query(query, values);
    }

    getIdMapping(collection, mongoId) {
        return this.idMappings.get(`${collection}:${mongoId}`);
    }
}

class MigrationOrchestrator {
    constructor() {
        this.logger = new Logger();
        this.mongoClient = null;
        this.pgPool = null;
        this.migrator = null;
    }

    async initialize() {
        await this.logger.init();
        
        // Conectar a MongoDB
        this.mongoClient = new MongoClient(CONFIG.mongodb.url);
        await this.mongoClient.connect();
        await this.logger.log('INFO', 'Conectado a MongoDB');
        
        // Conectar a PostgreSQL
        this.pgPool = new Pool(CONFIG.postgresql);
        await this.pgPool.query('SELECT NOW()'); // Test connection
        await this.logger.log('INFO', 'Conectado a PostgreSQL');
        
        this.migrator = new PostgreSQLMigrator(this.pgPool, this.logger);
    }

    async migrate() {
        try {
            await this.initialize();
            
            const db = this.mongoClient.db(CONFIG.mongodb.database);
            
            // Obtener colecciones a migrar
            const collectionsToMigrate = CONFIG.migration.targetCollection 
                ? [CONFIG.migration.targetCollection]
                : MIGRATION_ORDER;
            
            for (const collection of collectionsToMigrate) {
                try {
                    await this.logger.log('INFO', `Iniciando migración de colección: ${collection}`);
                    
                    // Obtener datos de MongoDB
                    const mongoData = await db.collection(collection).find({}).toArray();
                    
                    if (mongoData.length === 0) {
                        await this.logger.log('INFO', `Colección ${collection} está vacía, omitiendo`);
                        continue;
                    }
                    
                    // Seleccionar transformer y validator
                    const { transformer, validator } = this.getTransformerAndValidator(collection);
                    
                    // Migrar datos
                    await this.migrator.migrateCollection(collection, mongoData, transformer, validator);
                    
                } catch (error) {
                    this.logger.addError(error, `Migración de colección ${collection}`);
                    
                    if (!CONFIG.migration.continueOnError) {
                        throw error;
                    }
                }
            }
            
            await this.logger.log('INFO', 'Migración completada exitosamente');
            
        } catch (error) {
            await this.logger.log('ERROR', 'Error durante la migración', error);
            throw error;
        } finally {
            await this.cleanup();
        }
    }

    getTransformerAndValidator(collection) {
        const transformers = {
            'users': { transformer: DataTransformer.transformUser, validator: DataValidator.validateUser },
            'contacts': { transformer: DataTransformer.transformContact, validator: DataValidator.validateContact },
            'conversations': { transformer: DataTransformer.transformConversation, validator: DataValidator.validateConversation },
            'messages': { transformer: DataTransformer.transformMessage, validator: DataValidator.validateMessage },
            'templates': { transformer: DataTransformer.transformTemplate, validator: null }
        };
        
        return transformers[collection] || { transformer: (data) => data, validator: null };
    }

    async cleanup() {
        if (this.mongoClient) {
            await this.mongoClient.close();
            await this.logger.log('INFO', 'Conexión MongoDB cerrada');
        }
        
        if (this.pgPool) {
            await this.pgPool.end();
            await this.logger.log('INFO', 'Pool PostgreSQL cerrado');
        }
        
        const stats = await this.logger.generateReport();
        
        console.log('\n=== RESUMEN DE MIGRACIÓN ===');
        console.log(`Duración: ${Math.round(stats.duration / 1000)} segundos`);
        console.log(`Errores totales: ${stats.errors.length}`);
        console.log(`Advertencias totales: ${stats.warnings.length}`);
        console.log('\nEstadísticas por colección:');
        
        Object.entries(stats.collections).forEach(([collection, stats]) => {
            console.log(`  ${collection}: ${stats.processed} procesados, ${stats.errors} errores`);
        });
    }
}

// Función principal
async function main() {
    try {
        const orchestrator = new MigrationOrchestrator();
        await orchestrator.migrate();
        process.exit(0);
    } catch (error) {
        console.error('Error fatal en la migración:', error);
        process.exit(1);
    }
}

// Ejecutar si es llamado directamente
// Ejecutar si es el módulo principal
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}

export {
    MigrationOrchestrator,
    DataTransformer,
    DataValidator,
    CONFIG
};
/**
 * =====================================================
 * ChatBot Enterprise - Prisma Service
 * =====================================================
 * 
 * Servicio principal para gestionar la conexión y operaciones
 * con la base de datos PostgreSQL usando Prisma ORM.
 */

import { PrismaClient } from '../../adapters/PrismaAdapter.js';

class PrismaService {
    constructor() {
        this.prisma = null;
        this.isConnected = false;
        this.connectionRetries = 0;
        this.maxRetries = 5;
        this.retryDelay = 1000; // 1 segundo
    }

    /**
     * Inicializar conexión con Prisma
     */
    async initialize() {
        try {
            this.prisma = new PrismaClient({
                log: [
                    { level: 'query', emit: 'event' },
                    { level: 'error', emit: 'stdout' },
                    { level: 'info', emit: 'stdout' },
                    { level: 'warn', emit: 'stdout' },
                ],
                errorFormat: 'pretty',
            });

            // Configurar logging de queries en desarrollo
            if (process.env.NODE_ENV === 'development') {
                this.prisma.$on('query', (e) => {
                    logger.info('Query: ' + e.query);
                    logger.info('Params: ' + e.params);
                    logger.info('Duration: ' + e.duration + 'ms');
                });
            }

            // Probar conexión
            await this.connect();
            
            logger.info('✅ Prisma Service inicializado correctamente');
            return this.prisma;

        } catch (error) {
            logger.error('❌ Error inicializando Prisma Service:', error);
            throw error;
        }
    }

    /**
     * Conectar a la base de datos
     */
    async connect() {
        try {
            await this.prisma.$connect();
            this.isConnected = true;
            this.connectionRetries = 0;
            logger.info('🔗 Conectado a PostgreSQL via Prisma');
        } catch (error) {
            this.isConnected = false;
            logger.error('❌ Error conectando a PostgreSQL:', error);
            
            if (this.connectionRetries < this.maxRetries) {
                this.connectionRetries++;
                logger.info(`🔄 Reintentando conexión (${this.connectionRetries}/${this.maxRetries})...`);
                
                await new Promise(resolve => setTimeout(resolve, this.retryDelay));
                return this.connect();
            }
            
            throw error;
        }
    }

    /**
     * Desconectar de la base de datos
     */
    async disconnect() {
        try {
            if (this.prisma) {
                await this.prisma.$disconnect();
                this.isConnected = false;
                logger.info('🔌 Desconectado de PostgreSQL');
            }
        } catch (error) {
            logger.error('❌ Error desconectando de PostgreSQL:', error);
            throw error;
        }
    }

    /**
     * Obtener instancia de Prisma
     */
    getClient() {
        if (!this.prisma) {
            throw new Error('Prisma no está inicializado. Llama a initialize() primero.');
        }
        return this.prisma;
    }

    /**
     * Verificar estado de conexión
     */
    async healthCheck() {
        try {
            if (!this.prisma) {
                return { status: 'error', message: 'Prisma no inicializado' };
            }

            // Ejecutar query simple para verificar conexión
            await this.prisma.$queryRaw`SELECT 1`;
            
            return {
                status: 'healthy',
                message: 'Conexión PostgreSQL activa',
                connected: this.isConnected,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            return {
                status: 'error',
                message: error.message,
                connected: false,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Ejecutar transacción
     */
    async transaction(operations) {
        try {
            return await this.prisma.$transaction(operations);
        } catch (error) {
            logger.error('❌ Error en transacción:', error);
            throw error;
        }
    }

    /**
     * Ejecutar query raw
     */
    async executeRaw(query, params = []) {
        try {
            return await this.prisma.$executeRawUnsafe(query, ...params);
        } catch (error) {
            logger.error('❌ Error ejecutando query raw:', error);
            throw error;
        }
    }

    /**
     * Obtener estadísticas de la base de datos
     */
    async getStats() {
        try {
            const stats = await this.prisma.$queryRaw`
                SELECT 
                    schemaname,
                    tablename,
                    attname,
                    n_distinct,
                    correlation
                FROM pg_stats 
                WHERE schemaname = 'public'
                ORDER BY tablename, attname;
            `;

            const tableStats = await this.prisma.$queryRaw`
                SELECT 
                    table_name,
                    (xpath('/row/cnt/text()', xml_count))[1]::text::int as row_count
                FROM (
                    SELECT 
                        table_name, 
                        query_to_xml(format('select count(*) as cnt from %I.%I', table_schema, table_name), false, true, '') as xml_count
                    FROM information_schema.tables 
                    WHERE table_schema = 'public'
                ) t;
            `;

            return {
                columnStats: stats,
                tableCounts: tableStats,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            logger.error('❌ Error obteniendo estadísticas:', error);
            throw error;
        }
    }

    /**
     * Limpiar cache de Prisma
     */
    async clearCache() {
        try {
            // Prisma no tiene cache explícito, pero podemos reiniciar la conexión
            await this.disconnect();
            await this.connect();
            logger.info('🧹 Cache de Prisma limpiado');
        } catch (error) {
            logger.error('❌ Error limpiando cache:', error);
            throw error;
        }
    }

    /**
     * Middleware para logging automático
     */
    setupMiddleware() {
        if (!this.prisma) {
            throw new Error('Prisma no está inicializado');
        }

        // Middleware para logging de operaciones
        this.prisma.$use(async (params, next) => {
            const before = Date.now();
            const result = await next(params);
            const after = Date.now();

            logger.info(`Query ${params.model}.${params.action} took ${after - before}ms`);
            return result;
        });

        // Middleware para soft delete (si se implementa)
        this.prisma.$use(async (params, next) => {
            if (params.action === 'delete') {
                // Cambiar delete por update con deletedAt
                params.action = 'update';
                params.args['data'] = { deletedAt: new Date() };
            }
            
            if (params.action === 'deleteMany') {
                params.action = 'updateMany';
                if (params.args.data != undefined) {
                    params.args.data['deletedAt'] = new Date();
                } else {
                    params.args['data'] = { deletedAt: new Date() };
                }
            }

            return next(params);
        });
    }
}

// Singleton instance
let prismaService = null;

/**
 * Obtener instancia singleton del servicio
 */
function getPrismaService() {
    if (!prismaService) {
        prismaService = new PrismaService();
    }
    return prismaService;
}

/**
 * Inicializar servicio (helper function)
 */
async function initializePrisma() {
    const service = getPrismaService();
    await service.initialize();
    return service;
}

export {
    PrismaService,
    getPrismaService,
    initializePrisma
};

export default PrismaService;
/**
 * =====================================================
 * ChatBot Enterprise - Base Repository
 * =====================================================
 * 
 * Repositorio base que proporciona operaciones CRUD
 * comunes para todas las entidades usando Prisma ORM.
 */

import { getPrismaService } from '../infrastructure/database/PrismaService.js';

class BaseRepository {
    constructor(modelName) {
        this.modelName = modelName;
        this.prismaService = getPrismaService();
    }

    /**
     * Obtener el modelo de Prisma
     */
    getModel() {
        const prisma = this.prismaService.getClient();
        return prisma[this.modelName];
    }

    /**
     * Crear un nuevo registro
     */
    async create(data, options = {}) {
        try {
            const model = this.getModel();
            return await model.create({
                data,
                ...options
            });
        } catch (error) {
            logger.error(`Error creando ${this.modelName}:`, error);
            throw error;
        }
    }

    /**
     * Buscar por ID
     */
    async findById(id, options = {}) {
        try {
            const model = this.getModel();
            return await model.findUnique({
                where: { id },
                ...options
            });
        } catch (error) {
            logger.error(`Error buscando ${this.modelName} por ID:`, error);
            throw error;
        }
    }

    /**
     * Buscar por UUID
     */
    async findByUuid(uuid, options = {}) {
        try {
            const model = this.getModel();
            return await model.findUnique({
                where: { uuid },
                ...options
            });
        } catch (error) {
            logger.error(`Error buscando ${this.modelName} por UUID:`, error);
            throw error;
        }
    }

    /**
     * Buscar uno por criterios
     */
    async findOne(where, options = {}) {
        try {
            const model = this.getModel();
            return await model.findFirst({
                where,
                ...options
            });
        } catch (error) {
            logger.error(`Error buscando ${this.modelName}:`, error);
            throw error;
        }
    }

    /**
     * Buscar múltiples registros
     */
    async findMany(options = {}) {
        try {
            const model = this.getModel();
            return await model.findMany(options);
        } catch (error) {
            logger.error(`Error buscando múltiples ${this.modelName}:`, error);
            throw error;
        }
    }

    /**
     * Buscar con paginación
     */
    async findWithPagination(options = {}) {
        try {
            const {
                page = 1,
                limit = 10,
                where = {},
                orderBy = {},
                include = {},
                select = null
            } = options;

            const skip = (page - 1) * limit;
            const model = this.getModel();

            const [data, total] = await Promise.all([
                model.findMany({
                    where,
                    orderBy,
                    include,
                    select,
                    skip,
                    take: limit
                }),
                model.count({ where })
            ]);

            return {
                data,
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit),
                    hasNext: page < Math.ceil(total / limit),
                    hasPrev: page > 1
                }
            };
        } catch (error) {
            logger.error(`Error en paginación de ${this.modelName}:`, error);
            throw error;
        }
    }

    /**
     * Actualizar por ID
     */
    async updateById(id, data, options = {}) {
        try {
            const model = this.getModel();
            return await model.update({
                where: { id },
                data,
                ...options
            });
        } catch (error) {
            logger.error(`Error actualizando ${this.modelName}:`, error);
            throw error;
        }
    }

    /**
     * Actualizar múltiples registros
     */
    async updateMany(where, data) {
        try {
            const model = this.getModel();
            return await model.updateMany({
                where,
                data
            });
        } catch (error) {
            logger.error(`Error actualizando múltiples ${this.modelName}:`, error);
            throw error;
        }
    }

    /**
     * Eliminar por ID
     */
    async deleteById(id) {
        try {
            const model = this.getModel();
            return await model.delete({
                where: { id }
            });
        } catch (error) {
            logger.error(`Error eliminando ${this.modelName}:`, error);
            throw error;
        }
    }

    /**
     * Eliminar múltiples registros
     */
    async deleteMany(where) {
        try {
            const model = this.getModel();
            return await model.deleteMany({
                where
            });
        } catch (error) {
            logger.error(`Error eliminando múltiples ${this.modelName}:`, error);
            throw error;
        }
    }

    /**
     * Contar registros
     */
    async count(where = {}) {
        try {
            const model = this.getModel();
            return await model.count({ where });
        } catch (error) {
            logger.error(`Error contando ${this.modelName}:`, error);
            throw error;
        }
    }

    /**
     * Verificar si existe
     */
    async exists(where) {
        try {
            const count = await this.count(where);
            return count > 0;
        } catch (error) {
            logger.error(`Error verificando existencia de ${this.modelName}:`, error);
            throw error;
        }
    }

    /**
     * Upsert (crear o actualizar)
     */
    async upsert(where, create, update, options = {}) {
        try {
            const model = this.getModel();
            return await model.upsert({
                where,
                create,
                update,
                ...options
            });
        } catch (error) {
            logger.error(`Error en upsert de ${this.modelName}:`, error);
            throw error;
        }
    }

    /**
     * Buscar o crear
     */
    async findOrCreate(where, create, options = {}) {
        try {
            let record = await this.findOne(where, options);
            
            if (!record) {
                record = await this.create({ ...where, ...create }, options);
            }
            
            return record;
        } catch (error) {
            logger.error(`Error en findOrCreate de ${this.modelName}:`, error);
            throw error;
        }
    }

    /**
     * Búsqueda de texto completo
     */
    async searchText(searchTerm, fields = [], options = {}) {
        try {
            if (!searchTerm || fields.length === 0) {
                return [];
            }

            const searchConditions = fields.map(field => ({
                [field]: {
                    contains: searchTerm,
                    mode: 'insensitive'
                }
            }));

            return await this.findMany({
                where: {
                    OR: searchConditions
                },
                ...options
            });
        } catch (error) {
            logger.error(`Error en búsqueda de texto de ${this.modelName}:`, error);
            throw error;
        }
    }

    /**
     * Obtener estadísticas básicas
     */
    async getStats() {
        try {
            const total = await this.count();
            const recent = await this.count({
                createdAt: {
                    gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // últimas 24 horas
                }
            });

            return {
                total,
                recent,
                model: this.modelName,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            logger.error(`Error obteniendo estadísticas de ${this.modelName}:`, error);
            throw error;
        }
    }

    /**
     * Ejecutar transacción
     */
    async transaction(operations) {
        try {
            const prisma = this.prismaService.getClient();
            return await prisma.$transaction(operations);
        } catch (error) {
            logger.error(`Error en transacción de ${this.modelName}:`, error);
            throw error;
        }
    }

    /**
     * Ejecutar query raw
     */
    async executeRaw(query, params = []) {
        try {
            return await this.prismaService.executeRaw(query, params);
        } catch (error) {
            logger.error(`Error ejecutando query raw en ${this.modelName}:`, error);
            throw error;
        }
    }
}

export default BaseRepository;
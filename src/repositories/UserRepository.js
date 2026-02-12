/**
 * =====================================================
 * ChatBot Enterprise - User Repository
 * =====================================================
 * 
 * Repositorio para gestionar operaciones de usuarios
 * con funcionalidades específicas del dominio.
 */

import BaseRepository from './BaseRepository.js';
import bcrypt from 'bcrypt';

class UserRepository extends BaseRepository {
    constructor() {
        super('user');
    }

    /**
     * Buscar usuario por email
     */
    async findByEmail(email, options = {}) {
        try {
            return await this.findOne({ email }, options);
        } catch (error) {
            logger.error('Error buscando usuario por email:', error);
            throw error;
        }
    }

    /**
     * Crear usuario con password hasheado
     */
    async createUser(userData) {
        try {
            const { password, ...otherData } = userData;
            
            // Hashear password
            const hashedPassword = await bcrypt.hash(password, 12);
            
            return await this.create({
                ...otherData,
                password: hashedPassword
            });
        } catch (error) {
            logger.error('Error creando usuario:', error);
            throw error;
        }
    }

    /**
     * Verificar credenciales de usuario
     */
    async verifyCredentials(email, password) {
        try {
            const user = await this.findByEmail(email);
            
            if (!user) {
                return null;
            }

            const isValidPassword = await bcrypt.compare(password, user.password);
            
            if (!isValidPassword) {
                return null;
            }

            // Actualizar último login
            await this.updateById(user.id, {
                lastLogin: new Date()
            });

            // Retornar usuario sin password
            const { password: _, ...userWithoutPassword } = user;
            return userWithoutPassword;
        } catch (error) {
            logger.error('Error verificando credenciales:', error);
            throw error;
        }
    }

    /**
     * Cambiar password de usuario
     */
    async changePassword(userId, currentPassword, newPassword) {
        try {
            const user = await this.findById(userId);
            
            if (!user) {
                throw new Error('Usuario no encontrado');
            }

            // Verificar password actual
            const isValidPassword = await bcrypt.compare(currentPassword, user.password);
            
            if (!isValidPassword) {
                throw new Error('Password actual incorrecto');
            }

            // Hashear nuevo password
            const hashedNewPassword = await bcrypt.hash(newPassword, 12);
            
            return await this.updateById(userId, {
                password: hashedNewPassword
            });
        } catch (error) {
            logger.error('Error cambiando password:', error);
            throw error;
        }
    }

    /**
     * Obtener usuarios activos
     */
    async getActiveUsers(options = {}) {
        try {
            return await this.findMany({
                where: { isActive: true },
                ...options
            });
        } catch (error) {
            logger.error('Error obteniendo usuarios activos:', error);
            throw error;
        }
    }

    /**
     * Obtener usuarios por rol
     */
    async getUsersByRole(role, options = {}) {
        try {
            return await this.findMany({
                where: { role },
                ...options
            });
        } catch (error) {
            logger.error('Error obteniendo usuarios por rol:', error);
            throw error;
        }
    }

    /**
     * Obtener agentes disponibles
     */
    async getAvailableAgents() {
        try {
            return await this.findMany({
                where: {
                    role: { in: ['AGENT', 'SUPERVISOR'] },
                    isActive: true
                },
                include: {
                    assignedConversations: {
                        where: {
                            status: { in: ['ACTIVE', 'PENDING'] }
                        }
                    }
                }
            });
        } catch (error) {
            logger.error('Error obteniendo agentes disponibles:', error);
            throw error;
        }
    }

    /**
     * Obtener estadísticas de usuarios
     */
    async getUserStats() {
        try {
            const prisma = this.prismaService.getClient();
            
            const stats = await prisma.user.groupBy({
                by: ['role'],
                _count: {
                    id: true
                },
                where: {
                    isActive: true
                }
            });

            const totalUsers = await this.count({ isActive: true });
            const recentLogins = await this.count({
                lastLogin: {
                    gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
                }
            });

            return {
                total: totalUsers,
                recentLogins,
                byRole: stats.reduce((acc, stat) => {
                    acc[stat.role] = stat._count.id;
                    return acc;
                }, {}),
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            logger.error('Error obteniendo estadísticas de usuarios:', error);
            throw error;
        }
    }

    /**
     * Desactivar usuario
     */
    async deactivateUser(userId) {
        try {
            return await this.updateById(userId, {
                isActive: false
            });
        } catch (error) {
            logger.error('Error desactivando usuario:', error);
            throw error;
        }
    }

    /**
     * Activar usuario
     */
    async activateUser(userId) {
        try {
            return await this.updateById(userId, {
                isActive: true
            });
        } catch (error) {
            logger.error('Error activando usuario:', error);
            throw error;
        }
    }

    /**
     * Actualizar permisos de usuario
     */
    async updatePermissions(userId, permissions) {
        try {
            return await this.updateById(userId, {
                permissions
            });
        } catch (error) {
            logger.error('Error actualizando permisos:', error);
            throw error;
        }
    }

    /**
     * Buscar usuarios con filtros avanzados
     */
    async searchUsers(filters = {}) {
        try {
            const {
                search,
                role,
                isActive,
                lastLoginAfter,
                lastLoginBefore,
                page = 1,
                limit = 10
            } = filters;

            const where = {};

            if (search) {
                where.OR = [
                    { name: { contains: search, mode: 'insensitive' } },
                    { email: { contains: search, mode: 'insensitive' } }
                ];
            }

            if (role) {
                where.role = role;
            }

            if (typeof isActive === 'boolean') {
                where.isActive = isActive;
            }

            if (lastLoginAfter || lastLoginBefore) {
                where.lastLogin = {};
                if (lastLoginAfter) where.lastLogin.gte = new Date(lastLoginAfter);
                if (lastLoginBefore) where.lastLogin.lte = new Date(lastLoginBefore);
            }

            return await this.findWithPagination({
                where,
                page,
                limit,
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    uuid: true,
                    name: true,
                    email: true,
                    role: true,
                    isActive: true,
                    lastLogin: true,
                    createdAt: true,
                    updatedAt: true
                }
            });
        } catch (error) {
            logger.error('Error buscando usuarios:', error);
            throw error;
        }
    }
}

export default UserRepository;
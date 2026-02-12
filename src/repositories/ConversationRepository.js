/**
 * =====================================================
 * ChatBot Enterprise - Conversation Repository
 * =====================================================
 * 
 * Repositorio para gestionar operaciones de conversaciones
 * con funcionalidades específicas del dominio.
 */

import BaseRepository from './BaseRepository.js';

class ConversationRepository extends BaseRepository {
    constructor() {
        super('conversation');
    }

    /**
     * Crear conversación con contacto
     */
    async createConversation(conversationData) {
        try {
            return await this.create(conversationData, {
                include: {
                    contact: true,
                    assignedTo: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            role: true
                        }
                    }
                }
            });
        } catch (error) {
            logger.error('Error creando conversación:', error);
            throw error;
        }
    }

    /**
     * Obtener conversaciones activas
     */
    async getActiveConversations(options = {}) {
        try {
            return await this.findMany({
                where: {
                    status: { in: ['ACTIVE', 'PENDING'] }
                },
                include: {
                    contact: true,
                    assignedTo: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            role: true
                        }
                    },
                    _count: {
                        select: {
                            messages: true
                        }
                    }
                },
                orderBy: {
                    lastMessageAt: 'desc'
                },
                ...options
            });
        } catch (error) {
            logger.error('Error obteniendo conversaciones activas:', error);
            throw error;
        }
    }

    /**
     * Obtener conversaciones por agente
     */
    async getConversationsByAgent(agentId, options = {}) {
        try {
            return await this.findMany({
                where: {
                    assignedToId: agentId
                },
                include: {
                    contact: true,
                    _count: {
                        select: {
                            messages: true
                        }
                    }
                },
                orderBy: {
                    lastMessageAt: 'desc'
                },
                ...options
            });
        } catch (error) {
            logger.error('Error obteniendo conversaciones por agente:', error);
            throw error;
        }
    }

    /**
     * Obtener conversaciones por contacto
     */
    async getConversationsByContact(contactId, options = {}) {
        try {
            return await this.findMany({
                where: {
                    contactId
                },
                include: {
                    assignedTo: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            role: true
                        }
                    },
                    messages: {
                        orderBy: {
                            createdAt: 'asc'
                        },
                        take: 10 // Últimos 10 mensajes por defecto
                    }
                },
                orderBy: {
                    createdAt: 'desc'
                },
                ...options
            });
        } catch (error) {
            logger.error('Error obteniendo conversaciones por contacto:', error);
            throw error;
        }
    }

    /**
     * Asignar conversación a agente
     */
    async assignToAgent(conversationId, agentId) {
        try {
            return await this.updateById(conversationId, {
                assignedToId: agentId,
                status: 'ACTIVE'
            }, {
                include: {
                    contact: true,
                    assignedTo: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            role: true
                        }
                    }
                }
            });
        } catch (error) {
            logger.error('Error asignando conversación:', error);
            throw error;
        }
    }

    /**
     * Cambiar estado de conversación
     */
    async changeStatus(conversationId, status) {
        try {
            return await this.updateById(conversationId, {
                status
            });
        } catch (error) {
            logger.error('Error cambiando estado de conversación:', error);
            throw error;
        }
    }

    /**
     * Cambiar prioridad de conversación
     */
    async changePriority(conversationId, priority) {
        try {
            return await this.updateById(conversationId, {
                priority
            });
        } catch (error) {
            logger.error('Error cambiando prioridad de conversación:', error);
            throw error;
        }
    }

    /**
     * Actualizar último mensaje
     */
    async updateLastMessage(conversationId) {
        try {
            return await this.updateById(conversationId, {
                lastMessageAt: new Date()
            });
        } catch (error) {
            logger.error('Error actualizando último mensaje:', error);
            throw error;
        }
    }

    /**
     * Incrementar contador de mensajes
     */
    async incrementMessageCount(conversationId) {
        try {
            const prisma = this.prismaService.getClient();
            return await prisma.conversation.update({
                where: { id: conversationId },
                data: {
                    messageCount: {
                        increment: 1
                    },
                    lastMessageAt: new Date()
                }
            });
        } catch (error) {
            logger.error('Error incrementando contador de mensajes:', error);
            throw error;
        }
    }

    /**
     * Obtener conversaciones pendientes
     */
    async getPendingConversations(options = {}) {
        try {
            return await this.findMany({
                where: {
                    status: 'PENDING',
                    assignedToId: null
                },
                include: {
                    contact: true,
                    _count: {
                        select: {
                            messages: true
                        }
                    }
                },
                orderBy: [
                    { priority: 'desc' },
                    { createdAt: 'asc' }
                ],
                ...options
            });
        } catch (error) {
            logger.error('Error obteniendo conversaciones pendientes:', error);
            throw error;
        }
    }

    /**
     * Obtener estadísticas de conversaciones
     */
    async getConversationStats(filters = {}) {
        try {
            const prisma = this.prismaService.getClient();
            const { startDate, endDate, agentId, channel } = filters;

            const where = {};
            
            if (startDate || endDate) {
                where.createdAt = {};
                if (startDate) where.createdAt.gte = new Date(startDate);
                if (endDate) where.createdAt.lte = new Date(endDate);
            }

            if (agentId) {
                where.assignedToId = agentId;
            }

            if (channel) {
                where.channel = channel;
            }

            const [
                totalConversations,
                activeConversations,
                pendingConversations,
                resolvedConversations,
                statusStats,
                channelStats,
                priorityStats
            ] = await Promise.all([
                this.count(where),
                this.count({ ...where, status: 'ACTIVE' }),
                this.count({ ...where, status: 'PENDING' }),
                this.count({ ...where, status: 'RESOLVED' }),
                prisma.conversation.groupBy({
                    by: ['status'],
                    _count: { id: true },
                    where
                }),
                prisma.conversation.groupBy({
                    by: ['channel'],
                    _count: { id: true },
                    where
                }),
                prisma.conversation.groupBy({
                    by: ['priority'],
                    _count: { id: true },
                    where
                })
            ]);

            return {
                total: totalConversations,
                active: activeConversations,
                pending: pendingConversations,
                resolved: resolvedConversations,
                byStatus: statusStats.reduce((acc, stat) => {
                    acc[stat.status] = stat._count.id;
                    return acc;
                }, {}),
                byChannel: channelStats.reduce((acc, stat) => {
                    acc[stat.channel] = stat._count.id;
                    return acc;
                }, {}),
                byPriority: priorityStats.reduce((acc, stat) => {
                    acc[stat.priority] = stat._count.id;
                    return acc;
                }, {}),
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            logger.error('Error obteniendo estadísticas de conversaciones:', error);
            throw error;
        }
    }

    /**
     * Buscar conversaciones con filtros avanzados
     */
    async searchConversations(filters = {}) {
        try {
            const {
                search,
                status,
                channel,
                priority,
                assignedToId,
                contactId,
                startDate,
                endDate,
                page = 1,
                limit = 10
            } = filters;

            const where = {};

            if (search) {
                where.OR = [
                    { subject: { contains: search, mode: 'insensitive' } },
                    { contact: { name: { contains: search, mode: 'insensitive' } } },
                    { contact: { email: { contains: search, mode: 'insensitive' } } },
                    { contact: { phone: { contains: search, mode: 'insensitive' } } }
                ];
            }

            if (status) {
                where.status = Array.isArray(status) ? { in: status } : status;
            }

            if (channel) {
                where.channel = Array.isArray(channel) ? { in: channel } : channel;
            }

            if (priority) {
                where.priority = Array.isArray(priority) ? { in: priority } : priority;
            }

            if (assignedToId) {
                where.assignedToId = assignedToId;
            }

            if (contactId) {
                where.contactId = contactId;
            }

            if (startDate || endDate) {
                where.createdAt = {};
                if (startDate) where.createdAt.gte = new Date(startDate);
                if (endDate) where.createdAt.lte = new Date(endDate);
            }

            return await this.findWithPagination({
                where,
                page,
                limit,
                include: {
                    contact: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            phone: true,
                            avatar: true
                        }
                    },
                    assignedTo: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            role: true
                        }
                    },
                    _count: {
                        select: {
                            messages: true
                        }
                    }
                },
                orderBy: [
                    { priority: 'desc' },
                    { lastMessageAt: 'desc' }
                ]
            });
        } catch (error) {
            logger.error('Error buscando conversaciones:', error);
            throw error;
        }
    }

    /**
     * Obtener conversación con mensajes
     */
    async getConversationWithMessages(conversationId, messageLimit = 50) {
        try {
            return await this.findById(conversationId, {
                include: {
                    contact: true,
                    assignedTo: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            role: true
                        }
                    },
                    messages: {
                        orderBy: {
                            createdAt: 'asc'
                        },
                        take: messageLimit,
                        include: {
                            sender: {
                                select: {
                                    id: true,
                                    name: true,
                                    email: true,
                                    role: true
                                }
                            }
                        }
                    },
                    conversationTags: {
                        include: {
                            tag: true
                        }
                    }
                }
            });
        } catch (error) {
            logger.error('Error obteniendo conversación con mensajes:', error);
            throw error;
        }
    }

    /**
     * Cerrar conversaciones inactivas
     */
    async closeInactiveConversations(inactiveHours = 24) {
        try {
            const cutoffDate = new Date(Date.now() - inactiveHours * 60 * 60 * 1000);
            
            return await this.updateMany(
                {
                    status: 'ACTIVE',
                    lastMessageAt: {
                        lte: cutoffDate
                    }
                },
                {
                    status: 'CLOSED'
                }
            );
        } catch (error) {
            logger.error('Error cerrando conversaciones inactivas:', error);
            throw error;
        }
    }
}

export default ConversationRepository;
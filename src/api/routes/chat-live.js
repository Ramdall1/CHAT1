/**
 * Rutas para Chat en Vivo
 * Maneja todas las operaciones relacionadas con conversaciones en tiempo real
 */

import express from 'express';
import axios from 'axios';
import path from 'path';
import { getDatabaseService } from '../../services/DatabaseService.js';
import { createLogger } from '../../services/core/core/logger.js';
import Dialog360Integration from '../../integrations/360dialog/Dialog360Integration.js';

const router = express.Router();
const logger = createLogger('CHAT_LIVE');
const isChatLiveDebug = process.env.DEBUG_CHAT_LIVE === 'true';

// Instancia de Dialog360 para obtener información de contactos
let dialog360Instance = null;

// Inicializar Dialog360 si está configurado
try {
    if (process.env.D360_API_KEY && process.env.D360_PHONE_NUMBER_ID) {
        dialog360Instance = new Dialog360Integration({
            apiKey: process.env.D360_API_KEY,
            phoneNumberId: process.env.D360_PHONE_NUMBER_ID,
            baseUrl: process.env.D360_API_BASE || 'https://waba.360dialog.io'
        });
        logger.info('Dialog360 Integration inicializada para obtener nombres de contacto');

        // Intentar configuración automática de webhook
        const ngrokUrl = process.env.NGROK_URL;
        if (ngrokUrl) {
            const webhookUrl = `${ngrokUrl}/webhooks/360dialog`;
            try {
                await dialog360Instance.configureWebhook({
                    url: webhookUrl,
                    verify_token: process.env.WEBHOOK_VERIFY_TOKEN || 'default_verify_token'
                });
                logger.info(`✅ Webhook configurado automáticamente en 360Dialog: ${webhookUrl}`);
            } catch (webhookError) {
                logger.warn(`⚠️ No se pudo configurar webhook automáticamente: ${webhookError.message}`);
                logger.info(`ℹ️ Configura manualmente la URL del webhook en tu panel de 360Dialog:`);
                logger.info(`   URL: ${webhookUrl}`);
                logger.info(`   Activa: Messages y Message Echoes`);
            }
        } else {
            logger.info('ℹ️ NGROK_URL no disponible - configura manualmente el webhook en 360Dialog');
        }
    } else {
        logger.warn('Dialog360 no configurado - nombres de contacto limitados a base de datos local');
    }
} catch (error) {
    logger.error('Error inicializando Dialog360 Integration:', error);
}

/**
 * Función para obtener el nombre de contacto desde Dialog360
 */
async function getContactNameFromDialog360(phone) {
    if (!dialog360Instance) {
        if (isChatLiveDebug) logger.debug('Dialog360 instance no disponible');
        return null;
    }
    
    try {
        // Validar el número de teléfono antes de hacer la llamada
        if (!phone || typeof phone !== 'string' || phone.trim() === '') {
            if (isChatLiveDebug) logger.debug('Número de teléfono inválido para Dialog360');
            return null;
        }
        
        // Llamada con timeout adicional y manejo defensivo
        const profile = await Promise.race([
            dialog360Instance.getContactProfile(phone),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Dialog360 timeout')), 3000)
            )
        ]);
        
        if (profile && profile.name && typeof profile.name === 'string' && profile.name.trim() !== '') {
            if (isChatLiveDebug) logger.debug(`Perfil obtenido desde Dialog360 para ${phone}: ${profile.name}`);
            return profile.name.trim();
        }
        
        if (isChatLiveDebug) logger.debug(`No se encontró nombre en Dialog360 para ${phone}`);
        return null;
        
    } catch (error) {
        // Manejo más defensivo de errores
        const errorMessage = error?.message || 'Error desconocido';
        if (isChatLiveDebug) logger.debug(`Error al obtener perfil de ${phone} desde Dialog360: ${errorMessage}`);
        
        // No re-lanzar el error, solo retornar null
        return null;
    }
}

/**
 * Función para enriquecer contacto con información de Dialog360
 */
async function enrichContactInfo(phone, currentName) {
    try {
        if (isChatLiveDebug) logger.debug('🔍 enrichContactInfo llamado con:', { phone, currentName });
        
        // Validar el número de teléfono
        if (!phone || phone === 'Desconocido') {
            if (isChatLiveDebug) logger.debug('🔍 Número inválido, retornando:', currentName || 'Contacto desconocido');
            return currentName || (phone ? (phone.startsWith('+') ? phone : `+${phone}`) : 'Contacto desconocido');
        }
        
        // Si ya tenemos un nombre válido, lo usamos
        if (currentName && 
            currentName !== phone && 
            currentName !== 'Sin nombre' && 
            currentName !== 'Desconocido' &&
            currentName.trim() !== '') {
            if (isChatLiveDebug) logger.debug(`🔍 Usando nombre existente para ${phone}: ${currentName}`);
            return currentName;
        }
        
        // Intentar obtener el nombre desde Dialog360 con timeout
        let dialog360Name = null;
        try {
            // Agregar timeout para evitar bloqueos
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Timeout')), 5000)
            );
            
            dialog360Name = await Promise.race([
                getContactNameFromDialog360(phone),
                timeoutPromise
            ]);
        } catch (dialog360Error) {
            if (isChatLiveDebug) logger.debug(`No se pudo obtener nombre desde Dialog360 para ${phone}: ${dialog360Error.message}`);
        }
        
        if (dialog360Name && 
            dialog360Name !== phone && 
            dialog360Name !== 'Sin nombre' &&
            dialog360Name.trim() !== '') {
            
            logger.info(`Nombre obtenido desde Dialog360 para ${phone}: ${dialog360Name}`);
            
            // Actualizar en la base de datos local si es posible (sin bloquear)
            setImmediate(async () => {
                try {
                    const dbService = getDatabaseService();
                    await dbService.run(
                        'UPDATE contacts SET name = ? WHERE phone_number = ?',
                        [dialog360Name, phone]
                    );
                    if (isChatLiveDebug) logger.debug(`Nombre actualizado en base de datos local para ${phone}`);
                } catch (dbError) {
                    logger.warn(`No se pudo actualizar el nombre en BD para ${phone}:`, dbError.message);
                }
            });
            
            return dialog360Name;
        }
        
        // Fallback: usar nombre actual válido o formatear el teléfono
        if (currentName && currentName !== 'Sin nombre' && currentName !== 'Desconocido') {
            return currentName;
        }
        
        // Formatear el número de teléfono como último recurso
        const formattedPhone = phone.startsWith('+') ? phone : `+${phone}`;
        if (isChatLiveDebug) logger.debug(`🔍 Usando teléfono formateado para ${phone}: ${formattedPhone}`);
        return formattedPhone;
        
    } catch (error) {
        logger.error(`Error enriqueciendo contacto ${phone}:`, error.message);
        // En caso de error, devolver el mejor nombre disponible
        if (currentName && currentName !== 'Sin nombre' && currentName !== 'Desconocido') {
            return currentName;
        }
        return phone && phone.startsWith('+') ? phone : `+${phone || 'Contacto desconocido'}`;
    }
}

// Función para obtener conversaciones reales desde SQLite
async function getRealConversations() {
    try {
        logger.info('Iniciando getRealConversations (versión SQLite directa)...');
        
        // Importar SQLite directamente
        const sqlite3 = await import('sqlite3');
        const path = await import('path');
        const fs = await import('fs');
        
        // Ruta de la base de datos
        const dbPath = path.join(process.cwd(), 'data', 'database.sqlite');
        
        // Verificar si existe la base de datos
        if (!fs.existsSync(dbPath)) {
            logger.error('❌ Base de datos no encontrada en:', dbPath);
            return [];
        }
        
        // Crear conexión directa a SQLite
        const db = new sqlite3.default.Database(dbPath);
        
        try {
            // Función helper para promisificar consultas
            const queryAsync = (sql, params = []) => {
                return new Promise((resolve, reject) => {
                    db.all(sql, params, (err, rows) => {
                        if (err) reject(err);
                        else resolve(rows);
                    });
                });
            };
            
            // Obtener conversaciones reales de la tabla conversations
            let conversations = [];
            try {
                logger.info('🔍 Ejecutando consulta de conversaciones...');
                
                // Primero, verificar que la tabla existe y tiene datos
                const tableCheck = await queryAsync("SELECT COUNT(*) as count FROM conversations");
                logger.info(`📊 Total de conversaciones en BD: ${tableCheck[0]?.count || 0}`);
                
                // Consulta que obtiene conversaciones Y contactos con mensajes
                // Obtener el último mensaje de cada contacto (sin filtros de contenido)
                const conversationsQuery = `
                    SELECT DISTINCT
                        COALESCE(c.id, NULL) as id,
                        ct.id as contact_id,
                        COALESCE(c.status, 'active') as status,
                        COALESCE(c.last_message_at, MAX(m.created_at)) as last_message_at,
                        COALESCE(c.message_count, COUNT(m.id)) as message_count,
                        COALESCE(c.created_at, MIN(m.created_at)) as created_at,
                        COALESCE(c.updated_at, MAX(m.created_at)) as updated_at,
                        (SELECT m2.content FROM messages m2 WHERE m2.contact_id = ct.id ORDER BY m2.created_at DESC LIMIT 1) as last_message_content
                    FROM contacts ct
                    LEFT JOIN conversations c ON c.contact_id = ct.id
                    LEFT JOIN messages m ON m.contact_id = ct.id
                    WHERE ct.id IN (
                        SELECT DISTINCT contact_id FROM messages
                        UNION
                        SELECT DISTINCT contact_id FROM conversations
                    )
                    GROUP BY ct.id, c.id
                    ORDER BY COALESCE(c.last_message_at, MAX(m.created_at)) DESC
                    LIMIT 50
                `;

                conversations = await queryAsync(conversationsQuery);
                logger.info(`✅ Consulta ejecutada: ${conversations.length} conversaciones encontradas`);
                
                // Ahora agregar información de contactos manualmente
                if (conversations.length > 0) {
                    conversations = await Promise.all(conversations.map(async (conv) => {
                        try {
                            const contact = await new Promise((resolve, reject) => {
                                db.get("SELECT * FROM contacts WHERE id = ?", [conv.contact_id], (err, row) => {
                                    if (err) reject(err);
                                    else resolve(row);
                                });
                            });
                            return {
                                ...conv,
                                contact_phone: contact?.phone_number || 'Desconocido',
                                contact_name: contact?.name || 'Sin nombre',
                                contact_avatar: contact?.profile_picture_url || null
                            };
                        } catch (e) {
                            logger.warn(`Error obteniendo contacto para conversación ${conv.id}:`, e.message);
                            return {
                                ...conv,
                                contact_phone: 'Desconocido',
                                contact_name: 'Sin nombre',
                                contact_avatar: null
                            };
                        }
                    }));
                    logger.info(`✅ Información de contactos agregada`);
                }
                if (isChatLiveDebug) {
                    logger.debug(`✅ ${conversations.length} conversaciones encontradas`);
                    if (conversations.length > 0) {
                        logger.debug(`📋 Contacto ${conversations[0].contact_phone}: nombre en BD = "${conversations[0].contact_name}"`);
                    }
                }

            } catch (dbError) {
                logger.error('❌ Error consultando conversaciones:', dbError.message);
                logger.error('Stack trace:', dbError.stack);
                logger.error('Código de error:', dbError.code);
                db.close();
                return [];
            }
            
            // Si no hay conversaciones, retornar array vacío
            if (conversations.length === 0) {
                logger.info('ℹ️  No hay conversaciones activas');
                db.close();
                return [];
            }
            
            // Procesar conversaciones y contar mensajes no leídos
            const processedConversations = await Promise.all(conversations.map(async (conv) => {
                const displayName = conv.contact_name || conv.contact_phone || 'Desconocido';

                // Log del contenido raw para debugging
                if (isChatLiveDebug) logger.info(`📝 Procesando conversación ${conv.contact_phone}: last_message_content = "${conv.last_message_content}"`);
                
                // Extraer el último mensaje del contenido
                let lastMessage = 'Sin mensajes';
                
                if (conv.last_message_content && conv.last_message_content.trim() !== '') {
                    const rawContent = conv.last_message_content.trim();
                    
                    // Primero intentar usar el contenido directamente (texto plano)
                    if (rawContent && !rawContent.startsWith('{') && !rawContent.startsWith('[')) {
                        // Es texto plano, usar directamente
                        lastMessage = rawContent;
                        if (isChatLiveDebug) logger.info(`📝 Contenido texto plano para ${conv.contact_phone}: "${lastMessage}"`);
                    } else {
                        // Intentar parsear como JSON
                        try {
                            const contentObj = JSON.parse(rawContent);
                            
                            // Buscar el contenido del mensaje en diferentes campos posibles
                            lastMessage = contentObj.text || 
                                         contentObj.content || 
                                         contentObj.caption || 
                                         contentObj.body ||
                                         contentObj.message ||
                                         (contentObj.type === 'image' ? '🖼️ Imagen' : null) ||
                                         (contentObj.type === 'video' ? '🎥 Video' : null) ||
                                         (contentObj.type === 'audio' ? '🎤 Audio' : null) ||
                                         (contentObj.type === 'document' ? '📄 Documento' : null) ||
                                         'Mensaje multimedia';
                                         
                            if (isChatLiveDebug) logger.debug(`📝 Contenido JSON parseado para ${conv.contact_phone}: "${lastMessage}"`);
                        } catch (e) {
                            // Si falla el parse, usar el contenido raw
                            lastMessage = rawContent || 'Sin mensajes';
                            if (isChatLiveDebug) logger.debug(`📝 Error parseando JSON, usando raw para ${conv.contact_phone}: "${lastMessage}"`);
                        }
                    }
                    
                    // Limitar la longitud del mensaje para la vista previa
                    if (lastMessage && lastMessage !== 'Sin mensajes' && lastMessage.length > 50) {
                        lastMessage = lastMessage.substring(0, 50) + '...';
                    }
                } else {
                    // Si no hay contenido en el campo content, buscar el tipo de mensaje más reciente
                    try {
                        const lastMsgQuery = await queryAsync(
                            `SELECT type FROM messages 
                             WHERE contact_id = ? 
                             ORDER BY created_at DESC 
                             LIMIT 1`,
                            [conv.contact_id]
                        );
                        
                        if (lastMsgQuery && lastMsgQuery.length > 0) {
                            const msgType = lastMsgQuery[0].type;
                            // Mostrar emoji según el tipo de mensaje
                            if (msgType === 'image') {
                                lastMessage = '🖼️ Imagen';
                            } else if (msgType === 'video') {
                                lastMessage = '🎥 Video';
                            } else if (msgType === 'audio') {
                                lastMessage = '🎤 Audio';
                            } else if (msgType === 'document') {
                                lastMessage = '📄 Documento';
                            } else if (msgType === 'location') {
                                lastMessage = '📍 Ubicación';
                            } else {
                                lastMessage = 'Mensaje multimedia';
                            }
                            logger.info(`📝 Último mensaje para ${conv.contact_phone} es tipo: ${msgType} → ${lastMessage}`);
                        } else {
                            logger.info(`⚠️ No hay mensajes para ${conv.contact_phone}`);
                            lastMessage = 'Sin mensajes';
                        }
                    } catch (typeError) {
                        logger.warn(`Error obteniendo tipo de mensaje para ${conv.contact_phone}:`, typeError.message);
                        lastMessage = 'Sin mensajes';
                    }
                }
                
                // Contar mensajes no leídos para esta conversación
                // Solo contar mensajes entrantes (inbound) que no han sido marcados como leídos
                let unreadCount = 0;
                try {
                    const unreadResult = await queryAsync(
                        `SELECT COUNT(*) as count FROM messages m
                         JOIN contacts c ON m.contact_id = c.id
                         WHERE c.phone_number = ?
                         AND m.direction = 'inbound' 
                         AND (m.status IS NULL OR m.status = '' OR m.status = 'received' OR m.status NOT IN ('read', 'delivered', 'sent'))`,
                        [conv.contact_phone]
                    );
                    const count = unreadResult[0]?.count || 0;
                    unreadCount = count;
                    
                    if (isChatLiveDebug) logger.info(`📊 Mensajes no leídos para ${conv.contact_phone}: ${count}`);
                } catch (unreadError) {
                    logger.warn(`Error contando mensajes no leídos para ${conv.contact_phone}:`, unreadError.message);
                    unreadCount = 0;
                }
                
                return {
                    id: conv.id,
                    phone: conv.contact_phone || 'Desconocido',
                    name: displayName,
                    avatar: conv.contact_avatar || null,
                    lastMessage: lastMessage,
                    lastMessageTime: conv.last_message_at || conv.created_at,
                    unreadCount: unreadCount,
                    messageCount: conv.message_count || 0,
                    status: conv.status || 'active',
                    channel: conv.channel || 'whatsapp',
                    priority: conv.priority || 'medium'
                };
            }));
            
            // Cerrar conexión
            db.close();
            
            logger.info(`getRealConversations completado: ${processedConversations.length} conversaciones procesadas`);
            return processedConversations;
            
        } catch (queryError) {
            logger.error('Error ejecutando consultas:', queryError.message);
            db.close();
            return [];
        }
        
    } catch (error) {
        logger.error('Error crítico en getRealConversations:', error.message);
        logger.error('Stack trace:', error.stack);
        return [];
    }
}

/**
 * Función para obtener mensajes de una conversación específica desde SQLite
 */
async function getConversationMessages(conversationId, limit = 50, offset = 0) {
    try {
        const dbService = getDatabaseService();
        await dbService.initialize();
        
        // Obtener mensajes de la conversación
        const messagesQuery = `
                SELECT 
                    m.id,
                    m.conversation_id,
                    m.type,
                    m.direction,
                    m.content,
                    m.media_url,
                    m.media_type,
                    m.status,
                    m.message_id,
                    m.sent_at,
                    m.delivered_at,
                    m.read_at,
                    m.created_at,
                    ct.name as contact_name,
                    ct.phone_number as contact_phone
                FROM Messages m
                LEFT JOIN Contacts ct ON m.contact_id = ct.id
                WHERE m.conversation_id = ?
                ORDER BY m.created_at DESC
                LIMIT ? OFFSET ?
            `;
            
            const messages = await dbService.all(messagesQuery, [conversationId, limit, offset]);
            
            return messages.map(msg => {
                let content = 'Mensaje multimedia';
                try {
                    if (msg.content) {
                        const contentObj = JSON.parse(msg.content);
                        content = contentObj.text || contentObj.content || 'Mensaje multimedia';
                    }
                } catch (e) {
                    content = msg.content || 'Mensaje multimedia';
                }
                
                return {
                    id: msg.id,
                    conversationId: msg.conversation_id,
                    contactId: null,
                    userId: null,
                    type: msg.type,
                    direction: msg.direction,
                    content: content,
                    mediaUrl: msg.media_url,
                    mediaType: msg.media_type,
                    status: msg.status,
                    messageId: msg.message_id,
                    sentAt: msg.sent_at,
                    deliveredAt: msg.delivered_at,
                    readAt: msg.read_at,
                    timestamp: msg.created_at,
                    contactName: msg.contact_name || msg.contact_phone,
                    contactPhone: msg.contact_phone
                };
            });
        
    } catch (error) {
        logger.error('Error obteniendo mensajes de conversación desde SQLite:', error);
        return [];
    }
}

// Datos hardcodeados eliminados - ahora solo se usan datos reales de SQLite

// Middleware para logging
router.use((req, res, next) => {
    logger.debug(`[CHAT-LIVE] ${req.method} ${req.path}`, {
        timestamp: new Date().toISOString(),
        ip: req.ip,
        userAgent: req.get('User-Agent')
    });
    next();
});

/**
 * GET /api/chat-live/conversations
 * Obtiene todas las conversaciones
 */
router.get('/conversations', async (req, res) => {
    try {
        logger.debug('🔍 [DEBUG] Ruta /conversations llamada');
        const { status, search, page = 1, limit = 10 } = req.query;
        
        logger.debug('🔍 [DEBUG] Iniciando getRealConversations...');
        // Obtener conversaciones reales
        let filteredConversations = await getRealConversations();
        logger.debug('🔍 [DEBUG] getRealConversations completado:', filteredConversations ? filteredConversations.length : 'null', 'conversaciones');
        if (filteredConversations && filteredConversations.length > 0) {
            logger.debug('🔍 [DEBUG] Primera conversación:', JSON.stringify(filteredConversations[0], null, 2));
        }
        logger.info(`getRealConversations devolvió: ${filteredConversations ? filteredConversations.length : 'null'} conversaciones`);
        
        // Si no hay conversaciones, devolver array vacío (sin fallback a datos de ejemplo)
        if (!filteredConversations || filteredConversations.length === 0) {
            filteredConversations = [];
        }
        
        // Filtrar por estado
        if (status && status !== 'all') {
            filteredConversations = filteredConversations.filter(conv => conv.status === status);
        }
        
        // Filtrar por búsqueda
        if (search) {
            const searchLower = search.toLowerCase();
            filteredConversations = filteredConversations.filter(conv =>
                conv.name.toLowerCase().includes(searchLower) ||
                conv.phone.includes(search) ||
                conv.lastMessage.toLowerCase().includes(searchLower)
            );
        }
        
        // Paginación
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + parseInt(limit);
        const paginatedConversations = filteredConversations.slice(startIndex, endIndex);
        
        // Transformar datos para que coincidan con el formato esperado por el frontend
        const transformedConversations = paginatedConversations.map(conv => ({
            id: conv.id,
            phone: conv.phone,
            name: conv.name,
            avatar: conv.avatar || null,
            lastMessage: conv.lastMessage,
            lastMessageTime: conv.lastMessageTime || (conv.timestamp ? (typeof conv.timestamp === 'string' ? conv.timestamp : conv.timestamp.toISOString().slice(0, 19).replace('T', ' ')) : null),
            unreadCount: conv.unreadCount || 0,
            messageCount: conv.messageCount || 0,
            status: conv.status || 'active',
            channel: conv.channel || 'whatsapp',
            priority: conv.priority || 'medium'
        }));
        
        logger.debug('🔍 [DEBUG] Conversaciones transformadas:', transformedConversations.length);
        if (transformedConversations.length > 0) {
            logger.debug('🔍 [DEBUG] Primera conversación transformada:', JSON.stringify(transformedConversations[0], null, 2));
        }
        
        res.json({
            success: true,
            data: transformedConversations,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: filteredConversations.length,
                pages: Math.ceil(filteredConversations.length / limit)
            }
        });
    } catch (error) {
        logger.error('Error obteniendo conversaciones:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor'
        });
    }
});

/**
 * GET /api/chat-live/messages/by-phone/:phone
 * Obtiene mensajes reales desde SQLite filtrando por teléfono
 */
router.get('/messages/by-phone/:phone', async (req, res) => {
    try {
        const { phone } = req.params;
        const { page = 1, limit = 50 } = req.query;

        if (!phone || phone.trim() === '') {
            return res.status(400).json({ success: false, error: 'Parámetro phone requerido' });
        }

        // Leer directamente desde SQLite para evitar inconsistencias de capa ORM
        const sqlite3 = (await import('sqlite3')).default;
        const pathMod = await import('path');
        const fsMod = await import('fs');

        const dbPath = pathMod.join(process.cwd(), 'data', 'database.sqlite');
        if (!fsMod.existsSync(dbPath)) {
            return res.json({ success: true, data: [], pagination: { page: 1, limit: 0, total: 0, pages: 0, hasNext: false, hasPrev: false } });
        }

        const db = new sqlite3.Database(dbPath);

        const queryAll = (sql, params = []) => new Promise((resolve, reject) => {
            db.all(sql, params, (err, rows) => {
                if (err) return reject(err);
                resolve(rows || []);
            });
        });
        const queryGet = (sql, params = []) => new Promise((resolve, reject) => {
            db.get(sql, params, (err, row) => {
                if (err) return reject(err);
                resolve(row || null);
            });
        });

        const offset = (parseInt(page) - 1) * parseInt(limit);

        const rows = await queryAll(
            `SELECT
                m.id,
                m.type,
                m.direction,
                m.status,
                m.content,
                m.media_url,
                m.created_at,
                c.name as contact_name,
                c.phone_number as contact_phone
            FROM messages m
            JOIN contacts c ON m.contact_id = c.id
            WHERE c.phone_number = ?
            ORDER BY m.created_at DESC
            LIMIT ? OFFSET ?`,
            [phone, parseInt(limit), offset]
        );

        const totalRow = await queryGet(
            'SELECT COUNT(*) as total FROM messages m JOIN contacts c ON m.contact_id = c.id WHERE c.phone_number = ?',
            [phone]
        );
        const total = totalRow ? totalRow.total : 0;

        const messages = rows.map((msg) => {
            let content = 'Mensaje multimedia';
            try {
                if (msg.content) {
                    const obj = JSON.parse(msg.content);
                    content = obj.text || obj.content || 'Mensaje multimedia';
                }
            } catch (_) {
                content = msg.content || 'Mensaje multimedia';
            }

            return {
                id: msg.id,
                type: msg.type || 'text',
                direction: msg.direction,
                status: msg.status,
                content,
                mediaUrl: msg.media_url || null,
                mediaType: null,
                timestamp: msg.created_at,
                contactName: msg.contact_name || msg.contact_phone,
                contactPhone: msg.contact_phone,
                messageId: msg.message_id || null // ID de WhatsApp para marcar como leído
            };
        });

        db.close();

        return res.json({
            success: true,
            data: messages,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit)),
                hasNext: offset + parseInt(limit) < total,
                hasPrev: parseInt(page) > 1
            }
        });
    } catch (error) {
        logger.error('Error en /messages/by-phone:', error);
        logger.error('Stack trace:', error.stack);
        logger.error('Error message:', error.message);
        return res.status(500).json({
            success: false,
            error: 'Error interno del servidor',
            details: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

/**
 * GET /api/chat-live/conversations/:id
 * Obtiene una conversación específica
 */
router.get('/conversations/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        // Obtener todas las conversaciones y filtrar por ID
        const allConversations = await getRealConversations();
        const conversation = allConversations.find(conv => conv.id == id);
        
        if (!conversation) {
            return res.status(404).json({
                success: false,
                error: 'Conversación no encontrada'
            });
        }
        
        res.json({
            success: true,
            data: conversation
        });
        
    } catch (error) {
        logger.error('[CHAT-LIVE] Error al obtener conversación:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor'
        });
    }
});

/**
 * PUT /api/chat-live/conversations/:id
 * Actualiza una conversación
 */
router.put('/conversations/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        
        const conversationIndex = conversations.findIndex(conv => conv.id === id);
        
        if (conversationIndex === -1) {
            return res.status(404).json({
                success: false,
                error: 'Conversación no encontrada'
            });
        }
        
        // Actualizar conversación
        conversations[conversationIndex] = {
            ...conversations[conversationIndex],
            ...updates,
            timestamp: new Date()
        };
        
        res.json({
            success: true,
            data: conversations[conversationIndex]
        });
    } catch (error) {
        logger.error('[CHAT-LIVE] Error al actualizar conversación:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor'
        });
    }
});

/**
 * GET /api/chat-live/conversations/:id/messages
 * Obtiene los mensajes de una conversación
 */
router.get('/conversations/:id/messages', async (req, res) => {
    try {
        const { id } = req.params;
        const { page = 1, limit = 50 } = req.query;

        logger.info(`Obteniendo mensajes para conversación ${id}`);

        // Leer directamente desde SQLite para evitar inconsistencias
        const sqlite3 = (await import('sqlite3')).default;
        const pathMod = await import('path');
        const fsMod = await import('fs');

        const dbPath = pathMod.join(process.cwd(), 'data', 'database.sqlite');
        if (!fsMod.existsSync(dbPath)) {
            return res.json({
                success: true,
                data: { conversationId: id, messages: [], pagination: { page: 1, limit: 0, total: 0, pages: 0, hasNext: false, hasPrev: false } },
                timestamp: new Date().toISOString()
            });
        }

        const db = new sqlite3.Database(dbPath);

        const queryAll = (sql, params = []) => new Promise((resolve, reject) => {
            db.all(sql, params, (err, rows) => {
                if (err) return reject(err);
                resolve(rows || []);
            });
        });
        const queryGet = (sql, params = []) => new Promise((resolve, reject) => {
            db.get(sql, params, (err, row) => {
                if (err) return reject(err);
                resolve(row || null);
            });
        });

        const offset = (parseInt(page) - 1) * parseInt(limit);

        // Obtener mensajes de la conversación
        const rows = await queryAll(
            `SELECT
                m.id,
                m.conversation_id,
                m.type,
                m.direction,
                m.status,
                m.content,
                m.media_url,
                m.media_type,
                m.timestamp as sent_at,
                m.created_at as delivered_at,
                m.updated_at as read_at,
                m.created_at,
                c.name as contact_name,
                c.phone_number as contact_phone
            FROM messages m
            JOIN contacts c ON m.contact_id = c.id
            WHERE m.conversation_id = ?
            ORDER BY m.created_at DESC
            LIMIT ? OFFSET ?`,
            [id, parseInt(limit), offset]
        );

        // Obtener el total de mensajes
        const totalRow = await queryGet(
            'SELECT COUNT(*) as total FROM messages WHERE conversation_id = ?',
            [id]
        );
        const total = totalRow ? totalRow.total : 0;

        const messages = rows.map((msg) => {
            let content = 'Mensaje multimedia';
            try {
                if (msg.content) {
                    const obj = JSON.parse(msg.content);
                    content = obj.text || obj.content || 'Mensaje multimedia';
                }
            } catch (_) {
                content = msg.content || 'Mensaje multimedia';
            }

            return {
                id: msg.id,
                conversationId: msg.conversation_id,
                type: msg.type || 'text',
                direction: msg.direction,
                status: msg.status,
                content,
                mediaUrl: msg.media_url || null,
                mediaType: msg.media_type || null,
                sentAt: msg.sent_at,
                deliveredAt: msg.delivered_at,
                readAt: msg.read_at,
                timestamp: msg.created_at,
                contactName: msg.contact_name || msg.contact_phone,
                contactPhone: msg.contact_phone,
                messageId: msg.message_id || null
            };
        });

        db.close();

        const response = {
            success: true,
            data: {
                conversationId: id,
                messages: messages,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: total,
                    pages: Math.ceil(total / parseInt(limit)),
                    hasNext: offset + parseInt(limit) < total,
                    hasPrev: parseInt(page) > 1
                }
            },
            timestamp: new Date().toISOString()
        };

        logger.info(`Mensajes obtenidos: ${messages.length}/${total}`);
        res.json(response);

    } catch (error) {
        logger.error('Error obteniendo mensajes:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * POST /api/chat-live/conversations/:id/messages
 * Envía un nuevo mensaje a través de WhatsApp
 */
router.post('/conversations/:id/messages', async (req, res) => {
    try {
        const { id } = req.params;
        const { text, sender = 'agent', type = 'text', phone } = req.body;

        logger.info(`📨 POST /conversations/${id}/messages - phone: ${phone}, isNew: ${id.startsWith('new_')}`);

        if (!text || text.trim().length === 0) {
            return res.status(400).json({
                success: false,
                error: 'El texto del mensaje es requerido'
            });
        }

        // Obtener información de la conversación desde la base de datos
        const sqlite3 = (await import('sqlite3')).default;
        const pathMod = await import('path');
        const dbPath = pathMod.join(process.cwd(), 'data', 'database.sqlite');
        const db = new sqlite3.Database(dbPath);

        const queryGet = (sql, params = []) => new Promise((resolve, reject) => {
            db.get(sql, params, (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        let conversation = null;

        // Si es una conversación nueva (id comienza con 'new_'), usar el teléfono del body
        if (id.startsWith('new_')) {
            if (!phone) {
                db.close();
                return res.status(400).json({
                    success: false,
                    error: 'El teléfono es requerido para conversaciones nuevas'
                });
            }
            
            // Obtener contacto por teléfono
            const contactQuery = `SELECT id, phone_number, name FROM contacts WHERE phone_number = ?`;
            const contact = await queryGet(contactQuery, [phone]);
            
            if (contact) {
                conversation = {
                    phone_number: contact.phone_number,
                    name: contact.name
                };
            } else {
                // Si el contacto no existe, crear uno
                conversation = {
                    phone_number: phone,
                    name: phone
                };
            }
        } else {
            // Obtener el teléfono del contacto desde la conversación
            const conversationQuery = `
                SELECT c.phone_number, c.name
                FROM conversations conv
                JOIN contacts c ON conv.contact_id = c.id
                WHERE conv.id = ?
            `;

            conversation = await queryGet(conversationQuery, [id]);
        }

        db.close();

        if (!conversation) {
            return res.status(404).json({
                success: false,
                error: 'Conversación no encontrada'
            });
        }

        // Importar el servicio de 360Dialog
        const { default: Unified360DialogService } = await import('../../services/core/core/Unified360DialogService.js');
        const dialog360Service = new Unified360DialogService();
        
        let sentMessage = null;
        
        // Intentar enviar a WhatsApp usando 360Dialog (sin cola)
        logger.info(`📤 Enviando mensaje desde chat en vivo a ${conversation.phone_number}: ${text.trim()}`);
        try {
            sentMessage = await dialog360Service.sendTextMessage(
                conversation.phone_number, 
                text.trim(),
                { useQueue: false }  // ✅ Enviar directamente sin cola
            );
            logger.info(`✅ Mensaje enviado a WhatsApp: ${sentMessage?.messageId}`);
        } catch (sendError) {
            logger.error(`❌ Error enviando mensaje a WhatsApp: ${sendError.message}`);
            logger.warn(`⚠️ No se pudo enviar a WhatsApp, no guardando mensaje`);
            
            // NO guardar el mensaje si no se envió
            return res.status(500).json({
                success: false,
                error: `Error enviando mensaje a WhatsApp: ${sendError.message}`,
                details: sendError.message
            });
        }

        // Guardar mensaje en SQLite
        try {
            const { saveMessageToSQLite, createOrUpdateContact } = await import('../../services/core/core/SQLiteMessageHelper.js');
            
            // Asegurar que el contacto existe
            const contactId = await createOrUpdateContact(conversation.phone_number, conversation.name);
            
            // Guardar mensaje en SQLite con el WA.ID de 360Dialog
            await saveMessageToSQLite({
                contact_id: contactId,
                type: type || 'text',
                direction: 'outbound',
                content: text.trim(),
                media_url: null,
                status: 'sent',
                message_id: sentMessage.messageId  // ✅ WA.ID de 360Dialog
            });
            
            logger.info(`💾 Mensaje guardado en SQLite con WA.ID: ${sentMessage.messageId}`);
        } catch (saveError) {
            logger.error(`❌ Error guardando mensaje en SQLite: ${saveError.message}`);
            // Si falla guardar en SQLite pero se envió a WhatsApp, devolver éxito
        }

        // Crear respuesta con el mensaje enviado
        const newMessage = {
            id: sentMessage.messageId,  // ✅ WA.ID de 360Dialog
            conversationId: id,
            text: text.trim(),
            sender,
            timestamp: new Date().toISOString(),
            status: 'sent',  // ✅ Enviado a WhatsApp
            metadata: {
                type,
                agentId: sender === 'agent' ? 'agent_1' : null,
                whatsappMessageId: sentMessage.messageId  // ✅ WA.ID
            }
        };

        logger.info(`✅ Mensaje enviado exitosamente desde chat en vivo a ${conversation.phone_number}`);

        res.status(201).json({
            success: true,
            data: newMessage,
            message: 'Mensaje enviado exitosamente a WhatsApp'
        });
    } catch (error) {
        logger.error('[CHAT-LIVE] Error al enviar mensaje:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor',
            details: error.message
        });
    }
});

/**
 * GET /api/chat-live/stats
 * Obtiene estadísticas del chat en vivo
 */
router.get('/stats', async (req, res) => {
    try {
        const totalConversations = conversations.length;
        const activeConversations = conversations.filter(conv => conv.status === 'active').length;
        const waitingConversations = conversations.filter(conv => conv.status === 'waiting').length;
        const unreadConversations = conversations.filter(conv => conv.unread).length;
        
        const totalMessages = Object.values(messages).reduce((total, convMessages) => {
            return total + convMessages.length;
        }, 0);
        
        const todayMessages = Object.values(messages).reduce((total, convMessages) => {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            const todayCount = convMessages.filter(msg => {
                const msgDate = new Date(msg.timestamp);
                return msgDate >= today;
            }).length;
            
            return total + todayCount;
        }, 0);
        
        res.json({
            success: true,
            data: {
                conversations: {
                    total: totalConversations,
                    active: activeConversations,
                    waiting: waitingConversations,
                    unread: unreadConversations
                },
                messages: {
                    total: totalMessages,
                    today: todayMessages
                },
                agents: {
                    online: 1,
                    total: 1
                }
            }
        });
    } catch (error) {
        logger.error('[CHAT-LIVE] Error al obtener estadísticas:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor'
        });
    }
});

/**
 * POST /api/chat-live/typing
 * Maneja el estado de escritura
 */
router.post('/typing', async (req, res) => {
    try {
        const { conversationId, isTyping, sender = 'agent' } = req.body;
        
        // Aquí se podría implementar WebSocket para notificaciones en tiempo real
        logger.debug(`[CHAT-LIVE] ${sender} ${isTyping ? 'está escribiendo' : 'dejó de escribir'} en conversación ${conversationId}`);
        
        res.json({
            success: true,
            data: {
                conversationId,
                isTyping,
                sender,
                timestamp: new Date()
            }
        });
    } catch (error) {
        logger.error('[CHAT-LIVE] Error al manejar estado de escritura:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor'
        });
    }
});

/**
 * GET /api/chat-live/contacts/:phone
 * Obtiene información de un contacto por teléfono
 */
router.get('/contacts/:phone', async (req, res) => {
    try {
        const { phone } = req.params;
        
        // Buscar en conversaciones existentes
        const conversation = conversations.find(conv => conv.clientPhone === phone);
        
        if (conversation) {
            res.json({
                success: true,
                data: {
                    name: conversation.clientName,
                    phone: conversation.clientPhone,
                    email: conversation.clientEmail,
                    tags: conversation.tags,
                    lastContact: conversation.timestamp,
                    totalConversations: conversations.filter(conv => conv.clientPhone === phone).length
                }
            });
        } else {
            res.status(404).json({
                success: false,
                error: 'Contacto no encontrado'
            });
        }
    } catch (error) {
        logger.error('[CHAT-LIVE] Error al obtener contacto:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor'
        });
    }
});

/**
 * POST /api/chat-live/conversations
 * Crea una nueva conversación
 */
router.post('/conversations', async (req, res) => {
    try {
        const { clientName, clientPhone, clientEmail, initialMessage, source = 'manual' } = req.body;
        
        if (!clientName || !clientPhone) {
            return res.status(400).json({
                success: false,
                error: 'Nombre y teléfono del cliente son requeridos'
            });
        }
        
        const newConversation = {
            id: Date.now().toString(),
            clientName,
            clientPhone,
            clientEmail: clientEmail || '',
            lastMessage: initialMessage || 'Conversación iniciada',
            timestamp: new Date(),
            unread: true,
            status: 'active',
            tags: [],
            metadata: {
                source,
                agent: null,
                priority: 'medium'
            }
        };
        
        conversations.push(newConversation);
        
        // Si hay mensaje inicial, agregarlo
        if (initialMessage) {
            const firstMessage = {
                id: Date.now().toString(),
                conversationId: newConversation.id,
                text: initialMessage,
                sender: 'client',
                timestamp: new Date(),
                status: 'delivered',
                metadata: {
                    type: 'text',
                    source
                }
            };
            
            // Los mensajes se guardan automáticamente en SQLite
        }
        
        res.status(201).json({
            success: true,
            data: newConversation
        });
    } catch (error) {
        logger.error('[CHAT-LIVE] Error al crear conversación:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor'
        });
    }
});

/**
 * Proxy para servir media de 360Dialog con autenticación
 * GET /api/chat-live/media-proxy?url=ENCODED_URL
 */
router.get('/media-proxy', async (req, res) => {
    try {
        const mediaUrl = req.query.url;
        
        if (!mediaUrl) {
            return res.status(400).json({ error: 'URL del media requerida' });
        }
        
        // Decodificar la URL
        const decodedUrl = decodeURIComponent(mediaUrl);
        
        // Verificar que sea una URL de 360Dialog
        if (!decodedUrl.includes('waba-v2.360dialog.io')) {
            return res.status(403).json({ error: 'URL no autorizada' });
        }
        
        // Descargar el media con autenticación
        const apiKey = process.env.D360_API_KEY;
        const response = await axios.get(decodedUrl, {
            headers: {
                'D360-API-KEY': apiKey
            },
            responseType: 'arraybuffer'
        });
        
        // Reenviar el contenido con el tipo MIME correcto
        res.set('Content-Type', response.headers['content-type']);
        res.set('Cache-Control', 'public, max-age=300'); // Cache por 5 minutos
        res.send(response.data);
        
    } catch (error) {
        logger.error('Error en media proxy:', error.message);
        res.status(500).json({ error: 'Error descargando media' });
    }
});

/**
 * Marcar una conversación completa como leída
 */
router.post('/mark-conversation-read', async (req, res) => {
    try {
        const { conversationId } = req.body;
        
        logger.info(`📖 Marcando conversación como leída: ${conversationId}`);
        
        if (!conversationId) {
            return res.status(400).json({
                success: false,
                error: 'Se requiere el ID de la conversación'
            });
        }
        
        // Importar SQLite y abrir conexión a la base de datos
        const sqlite3 = (await import('sqlite3')).default;
        const pathMod = await import('path');
        const dbPath = pathMod.join(process.cwd(), 'data', 'database.sqlite');
        const db = new sqlite3.Database(dbPath);
        
        // Helper para promisificar las consultas
        const queryAll = (sql, params = []) => new Promise((resolve, reject) => {
            db.all(sql, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
        
        const queryRun = (sql, params = []) => new Promise((resolve, reject) => {
            db.run(sql, params, function(err) {
                if (err) reject(err);
                else resolve({ changes: this.changes, lastID: this.lastID });
            });
        });
        
        // Obtener el número de teléfono desde el conversation ID
        logger.info(`🔍 Procesando conversationId: ${conversationId} (tipo: ${typeof conversationId})`);
        
        const conversationQuery = `
            SELECT c.phone_number
            FROM conversations conv
            JOIN contacts c ON conv.contact_id = c.id
            WHERE conv.id = ?
        `;
        
        const conversationResult = await queryAll(conversationQuery, [conversationId]);
        
        if (conversationResult.length === 0) {
            logger.error(`❌ No se encontró conversación con ID ${conversationId}`);
            return res.status(404).json({
                success: false,
                error: `Conversación ${conversationId} no encontrada`
            });
        }
        
        const phoneNumber = conversationResult[0].phone_number;
        logger.info(`📞 Teléfono obtenido desde conversation ID ${conversationId}: ${phoneNumber}`);
        
        // Actualizar todos los mensajes entrantes como leídos para este contacto
        const result = await queryRun(
            `UPDATE messages
              SET status = 'read'
              WHERE contact_id IN (SELECT id FROM contacts WHERE phone_number = ?)
              AND direction = 'inbound'
              AND (status != 'read' OR status IS NULL)`,
            [phoneNumber]
        );
        
        logger.info(`✅ ${result.changes} mensajes marcados como leídos para ${phoneNumber}`);
        
        db.close();
        
        return res.json({
            success: true,
            updatedCount: result.changes,
            message: `${result.changes} mensajes marcados como leídos para ${phoneNumber}`
        });
        
    } catch (error) {
        logger.error('Error marcando conversación como leída:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Función auxiliar para marcar mensajes de WhatsApp como leídos
 */
async function markWhatsAppMessagesAsRead(messageIds) {
    if (!messageIds || !Array.isArray(messageIds) || messageIds.length === 0) {
        throw new Error('Se requiere un array de IDs de mensajes');
    }
    
    const apiKey = process.env.DIALOG360_API_KEY || process.env.D360_API_KEY;
    const baseUrl = process.env.WABA_API_BASE || 'https://waba-v2.360dialog.io';
    
    if (!apiKey) {
        throw new Error('API key no configurada');
    }
    
    const results = {
        success: [],
        failed: []
    };
    
    // Procesar cada mensaje
    for (const messageId of messageIds) {
        try {
            const response = await axios({
                method: 'POST',
                url: `${baseUrl}/v1/messages`,
                headers: {
                    'D360-API-KEY': apiKey,
                    'Content-Type': 'application/json'
                },
                data: {
                    messaging_product: 'whatsapp',
                    status: 'read',
                    message_id: messageId
                }
            });
            
            if (response.status === 200) {
                results.success.push(messageId);
            } else {
                results.failed.push({
                    messageId,
                    error: `Status code: ${response.status}`
                });
            }
        } catch (error) {
            results.failed.push({
                messageId,
                error: error.message
            });
        }
    }
    
    return results;
}

/**
 * POST /api/chat-live/update-contact
 * Actualizar información de contacto (desde chat interface)
 */
router.post('/update-contact', async (req, res) => {
    try {
        const { contactId, phone, field, value } = req.body;

        if (!contactId && !phone) {
            return res.status(400).json({
                success: false,
                error: 'Se requiere contactId o phone'
            });
        }

        if (!field) {
            return res.status(400).json({
                success: false,
                error: 'Se requiere el campo a actualizar'
            });
        }

        logger.info(`📝 Actualizando contacto - ContactId: ${contactId}, Phone: ${phone}, Field: ${field}, Value: ${value}`);

        // Usar SQLite directamente
        const sqlite3 = (await import('sqlite3')).default;
        const pathMod = await import('path');
        const dbPath = pathMod.join(process.cwd(), 'data', 'database.sqlite');
        const db = new sqlite3.Database(dbPath);

        const queryRun = (sql, params = []) => new Promise((resolve, reject) => {
            db.run(sql, params, function(err) {
                if (err) reject(err);
                else resolve({ changes: this.changes, lastID: this.lastID });
            });
        });

        const queryGet = (sql, params = []) => new Promise((resolve, reject) => {
            db.get(sql, params, (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        // Encontrar el contacto
        let contact;
        if (contactId) {
            contact = await queryGet('SELECT * FROM contacts WHERE id = ?', [contactId]);
        } else if (phone) {
            contact = await queryGet('SELECT * FROM contacts WHERE phone_number = ?', [phone]);
        }

        if (!contact) {
            db.close();
            return res.status(404).json({
                success: false,
                error: 'Contacto no encontrado'
            });
        }

        // Preparar actualización
        let updateField, updateValue;

        if (field === 'firstName' || field === 'lastName') {
            // Para firstName y lastName, actualizar el campo 'name' completo
            const currentName = contact.name || '';
            const nameParts = currentName.split(' ');

            if (field === 'firstName') {
                nameParts[0] = value.trim() || '';
            } else if (field === 'lastName') {
                if (nameParts.length > 1) {
                    nameParts.splice(1, nameParts.length - 1, value.trim());
                } else {
                    nameParts.push(value.trim());
                }
            }

            updateField = 'name';
            updateValue = nameParts.filter(part => part.trim()).join(' ').trim() || contact.phone_number;
        } else if (field === 'name') {
            updateField = 'name';
            updateValue = value.trim() === '' ? contact.phone_number : value; // Usar teléfono si está vacío
        } else if (field === 'email') {
            updateField = 'email';
            updateValue = value.trim() || null;
        }

        // Ejecutar actualización
        if (updateField) {
            await queryRun(`UPDATE contacts SET ${updateField} = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                          [updateValue, contact.id]);
        }

        db.close();

        logger.info(`✅ Contacto ${contact.id} actualizado: ${field} = ${value}`);

        res.json({
            success: true,
            message: 'Contacto actualizado correctamente'
        });

    } catch (error) {
        logger.error('❌ Error actualizando contacto:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor',
            details: error.message
        });
    }
});

/**
 * Marcar mensajes como leídos (doble check azul en WhatsApp)
 */
router.post('/mark-messages-read', async (req, res) => {
    try {
        const { messageIds } = req.body;
        
        if (!messageIds || !Array.isArray(messageIds) || messageIds.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Se requiere un array de IDs de mensajes'
            });
        }
        
        const apiKey = process.env.DIALOG360_API_KEY || process.env.D360_API_KEY;
        const baseUrl = process.env.WABA_API_BASE || 'https://waba-v2.360dialog.io';
        
        if (!apiKey) {
            return res.status(500).json({
                success: false,
                error: 'API key no configurada'
            });
        }
        
        const results = {
            success: [],
            failed: []
        };
        
        // Procesar cada mensaje
        for (const messageId of messageIds) {
            try {
                const response = await axios({
                    method: 'POST',
                    url: `${baseUrl}/v1/messages`,
                    headers: {
                        'D360-API-KEY': apiKey,
                        'Content-Type': 'application/json'
                    },
                    data: {
                        messaging_product: 'whatsapp',
                        status: 'read',
                        message_id: messageId
                    }
                });
                
                if (response.status === 200) {
                    results.success.push(messageId);
                } else {
                    results.failed.push({
                        messageId,
                        error: `Status code: ${response.status}`
                    });
                }
            } catch (error) {
                results.failed.push({
                    messageId,
                    error: error.message
                });
            }
        }
        
        return res.json({
            success: results.success.length > 0,
            totalProcessed: messageIds.length,
            successCount: results.success.length,
            failedCount: results.failed.length,
            results
        });
        
    } catch (error) {
        logger.error('Error marcando mensajes como leídos:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

export default router;
/**
 * Campaigns Routes - Rutas para gestión de campañas de difusión masiva
 */
import express from 'express';
import { createLogger } from '../../services/core/core/logger.js';
import { getDatabaseService } from '../../services/DatabaseService.js';
import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs/promises';
import { campaignMessagingService } from '../../services/campaigns/CampaignMessagingService.js';

const router = express.Router();
const logger = createLogger('CAMPAIGNS_ROUTES');

logger.info('✅ Campaigns Routes Module Loaded Successfully');

/**
 * Inicializar tablas de campañas
 */
async function initCampaignsTables() {
    const dbPath = path.join(process.cwd(), 'data', 'database.sqlite');
    const db = new sqlite3.Database(dbPath);
    
    const queryRun = (sql) => new Promise((resolve, reject) => {
        db.exec(sql, (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
    
    try {
        const migrationPath = path.join(process.cwd(), 'migrations', 'create_campaigns_table.sql');
        const sql = await fs.readFile(migrationPath, 'utf8');
        await queryRun(sql);
        logger.info('✅ Tablas de campañas inicializadas');
    } catch (error) {
        logger.error('❌ Error inicializando tablas:', error);
    } finally {
        db.close();
    }
}

// Inicializar al cargar el módulo
initCampaignsTables();

/**
 * GET /campaigns
 * Obtener lista de campañas
 */
router.get('/', async (req, res) => {
    try {
        const { page = 1, limit = 20, status } = req.query;
        
        logger.info(`📋 GET /campaigns - page: ${page}, limit: ${limit}, status: ${status || 'all'}`);
        
        const dbPath = path.join(process.cwd(), 'data', 'database.sqlite');
        const db = new sqlite3.Database(dbPath);

        const queryAll = (sql, params = []) => new Promise((resolve, reject) => {
            db.all(sql, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });

        const queryGet = (sql, params = []) => new Promise((resolve, reject) => {
            db.get(sql, params, (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        const offset = (page - 1) * limit;
        
        // Construir query
        let whereClause = '';
        const params = [];
        
        if (status) {
            whereClause = 'WHERE status = ?';
            params.push(status);
        }
        
        // Contar total
        const countQuery = `SELECT COUNT(*) as total FROM campaigns ${whereClause}`;
        const totalResult = await queryGet(countQuery, params);
        const total = totalResult ? totalResult.total : 0;
        
        // Obtener campañas
        const query = `
            SELECT id, name, description, message, media_url, media_type,
                   filters, total_recipients, sent_count, delivered_count, 
                   read_count, failed_count, status, scheduled_at, 
                   started_at, completed_at, created_by, created_at, updated_at
            FROM campaigns
            ${whereClause}
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
        `;
        
        const campaigns = await queryAll(query, [...params, parseInt(limit), parseInt(offset)]);
        
        // Procesar filtros (JSON string a objeto)
        const processedCampaigns = campaigns.map(campaign => ({
            ...campaign,
            filters: campaign.filters ? JSON.parse(campaign.filters) : {}
        }));
        
        db.close();
        
        logger.info(`✅ ${campaigns.length} campañas encontradas de ${total} total`);
        
        res.json({
            success: true,
            data: processedCampaigns,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            }
        });
        
    } catch (error) {
        logger.error('❌ Error obteniendo campañas:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor',
            message: error.message
        });
    }
});

/**
 * GET /campaigns/:id
 * Obtener una campaña específica
 */
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        logger.info(`📋 GET /campaigns/${id}`);
        
        const dbPath = path.join(process.cwd(), 'data', 'database.sqlite');
        const db = new sqlite3.Database(dbPath);

        const queryGet = (sql, params = []) => new Promise((resolve, reject) => {
            db.get(sql, params, (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        const campaign = await queryGet(
            'SELECT * FROM campaigns WHERE id = ?',
            [id]
        );
        
        db.close();
        
        if (!campaign) {
            return res.status(404).json({
                success: false,
                error: 'Campaña no encontrada'
            });
        }
        
        // Procesar filtros
        campaign.filters = campaign.filters ? JSON.parse(campaign.filters) : {};
        
        res.json({
            success: true,
            data: campaign
        });
        
    } catch (error) {
        logger.error('❌ Error obteniendo campaña:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor'
        });
    }
});

/**
 * POST /campaigns
 * Crear nueva campaña
 */
router.post('/', async (req, res) => {
    try {
        const {
            name,
            description,
            message,
            media_url,
            media_type,
            filters = {},
            scheduled_at,
            template_id,
            variable_mapping = '{}'
        } = req.body;
        
        logger.info(`📝 POST /campaigns - name: ${name}, template_id: ${template_id}`);
        
        // Solo requiere nombre (mensaje es opcional si hay template_id)
        if (!name) {
            return res.status(400).json({
                success: false,
                error: 'El nombre de la campaña es requerido'
            });
        }
        
        // Si no hay template_id, requiere mensaje
        if (!template_id && !message) {
            return res.status(400).json({
                success: false,
                error: 'El mensaje es requerido cuando no se usa una plantilla existente'
            });
        }
        
        const dbPath = path.join(process.cwd(), 'data', 'database.sqlite');
        const db = new sqlite3.Database(dbPath);

        const queryRun = (sql, params = []) => new Promise((resolve, reject) => {
            db.run(sql, params, function(err) {
                if (err) reject(err);
                else resolve({ changes: this.changes });
            });
        });

        const queryGet = (sql, params = []) => new Promise((resolve, reject) => {
            db.get(sql, params, (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
        
        // Calcular destinatarios basado en filtros
        const totalRecipients = await calculateRecipients(filters);
        
        const status = scheduled_at ? 'scheduled' : 'draft';
        
        // Insertar campaña (UUID se genera automáticamente)
        await queryRun(
            `INSERT INTO campaigns (
                name, description, message, media_url, media_type,
                filters, total_recipients, status, scheduled_at, template_id, variable_mapping
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                name,
                description,
                message || '',
                media_url,
                media_type,
                JSON.stringify(filters),
                totalRecipients,
                status,
                scheduled_at,
                template_id,
                typeof variable_mapping === 'string' ? variable_mapping : JSON.stringify(variable_mapping)
            ]
        );
        
        // Obtener el UUID de la campaña recién creada
        const campaign = await queryGet(
            `SELECT id FROM campaigns WHERE name = ? AND created_at = (SELECT MAX(created_at) FROM campaigns WHERE name = ?)`,
            [name, name]
        );
        
        db.close();
        
        const campaignId = campaign ? campaign.id : null;
        logger.info(`✅ Campaña creada con ID (UUID): ${campaignId}`);
        
        res.json({
            success: true,
            data: {
                id: campaignId,
                name,
                status,
                total_recipients: totalRecipients
            },
            message: 'Campaña creada correctamente'
        });
        
    } catch (error) {
        logger.error('❌ Error creando campaña:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor',
            message: error.message
        });
    }
});

/**
 * PUT /campaigns/:id
 * Actualizar campaña
 */
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const {
            name,
            description,
            message,
            media_url,
            media_type,
            filters,
            scheduled_at,
            variable_mapping
        } = req.body;
        
        logger.info(`📝 PUT /campaigns/${id}`);
        
        const dbPath = path.join(process.cwd(), 'data', 'database.sqlite');
        const db = new sqlite3.Database(dbPath);
        
        const queryRun = (sql, params = []) => new Promise((resolve, reject) => {
            db.run(sql, params, function(err) {
                if (err) reject(err);
                else resolve({ changes: this.changes });
            });
        });
        
        // Calcular destinatarios si los filtros cambiaron
        let totalRecipients = null;
        if (filters) {
            totalRecipients = await calculateRecipients(filters);
        }
        
        const updates = [];
        const params = [];
        
        if (name) { updates.push('name = ?'); params.push(name); }
        if (description !== undefined) { updates.push('description = ?'); params.push(description); }
        if (message) { updates.push('message = ?'); params.push(message); }
        if (media_url !== undefined) { updates.push('media_url = ?'); params.push(media_url); }
        if (media_type !== undefined) { updates.push('media_type = ?'); params.push(media_type); }
        if (filters) { 
            updates.push('filters = ?'); 
            params.push(JSON.stringify(filters));
            updates.push('total_recipients = ?');
            params.push(totalRecipients);
        }
        if (scheduled_at !== undefined) { updates.push('scheduled_at = ?'); params.push(scheduled_at); }
        if (variable_mapping !== undefined) { 
            updates.push('variable_mapping = ?'); 
            params.push(typeof variable_mapping === 'string' ? variable_mapping : JSON.stringify(variable_mapping));
        }
        
        updates.push('updated_at = CURRENT_TIMESTAMP');
        params.push(id);
        
        const result = await queryRun(
            `UPDATE campaigns SET ${updates.join(', ')} WHERE id = ?`,
            params
        );
        
        db.close();
        
        if (result.changes === 0) {
            return res.status(404).json({
                success: false,
                error: 'Campaña no encontrada'
            });
        }
        
        logger.info(`✅ Campaña ${id} actualizada`);
        
        res.json({
            success: true,
            message: 'Campaña actualizada correctamente'
        });
        
    } catch (error) {
        logger.error('❌ Error actualizando campaña:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor'
        });
    }
});

/**
 * DELETE /campaigns/:id
 * Eliminar campaña
 */
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        logger.info(`🗑️ DELETE /campaigns/${id}`);
        
        const dbPath = path.join(process.cwd(), 'data', 'database.sqlite');
        const db = new sqlite3.Database(dbPath);

        const queryRun = (sql, params = []) => new Promise((resolve, reject) => {
            db.run(sql, params, function(err) {
                if (err) reject(err);
                else resolve({ changes: this.changes });
            });
        });
        
        const result = await queryRun('DELETE FROM campaigns WHERE id = ?', [id]);
        
        db.close();
        
        if (result.changes === 0) {
            return res.status(404).json({
                success: false,
                error: 'Campaña no encontrada'
            });
        }
        
        logger.info(`✅ Campaña ${id} eliminada`);
        
        res.json({
            success: true,
            message: 'Campaña eliminada correctamente'
        });
        
    } catch (error) {
        logger.error('❌ Error eliminando campaña:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor'
        });
    }
});

/**
 * POST /campaigns/:id/send
 * Enviar campaña inmediatamente
 */
router.post('/:id/send', async (req, res) => {
    try {
        const { id } = req.params;
        
        logger.info(`📤 POST /campaigns/${id}/send - Iniciando endpoint`);
        logger.info(`🔍 Parámetros recibidos:`, { id });
        
        const dbPath = path.join(process.cwd(), 'data', 'database.sqlite');
        const db = new sqlite3.Database(dbPath);

        const queryGet = (sql, params = []) => new Promise((resolve, reject) => {
            db.get(sql, params, (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        const queryRun = (sql, params = []) => new Promise((resolve, reject) => {
            db.run(sql, params, function(err) {
                if (err) reject(err);
                else resolve({ id: this.lastID, changes: this.changes });
            });
        });
        
        // Obtener campaña
        const campaign = await queryGet('SELECT * FROM campaigns WHERE id = ?', [id]);
        
        if (!campaign) {
            db.close();
            return res.status(404).json({
                success: false,
                error: 'Campaña no encontrada'
            });
        }
        
        if (campaign.status === 'sending' || campaign.status === 'sent') {
            db.close();
            return res.status(400).json({
                success: false,
                error: 'La campaña ya fue enviada o se está enviando'
            });
        }
        
        console.log(`🔍 [DEBUG] Antes de actualizar estado a sending:`, { id, currentStatus: campaign.status });
        logger.info(`🔍 Antes de actualizar estado a sending:`, { id, currentStatus: campaign.status });
        
        // NO actualizar estado aquí - dejar que sendCampaign lo haga
        // Esto evita que la campaña quede en estado "sending" si hay un error
        
        console.log(`🔍 [DEBUG] Estado NO actualizado en endpoint - será actualizado por sendCampaign`);
        logger.info(`🔍 Estado NO actualizado en endpoint - será actualizado por sendCampaign`);
        console.log(`🔍 [DEBUG] Antes de llamar a processCampaignSending:`, {
            id,
            campaignName: campaign.name,
            hasVariableMapping: !!campaign.variable_mapping,
            variableMapping: campaign.variable_mapping
        });
        logger.info(`🔍 Antes de llamar a processCampaignSending:`, {
            id,
            campaignName: campaign.name,
            hasVariableMapping: !!campaign.variable_mapping,
            variableMapping: campaign.variable_mapping
        });
        
        db.close();
        
        // Parsear mapeo de variables AQUÍ en el endpoint
        let variableMapping = campaign.variable_mapping ? JSON.parse(campaign.variable_mapping) : {};
        console.log(`🔍 [DEBUG ENDPOINT] Mapeo parseado en endpoint:`, variableMapping);
        logger.info(`🔍 [ENDPOINT] Mapeo parseado:`, variableMapping);
        
        // Procesar envío en segundo plano - PASAR MAPEO DIRECTAMENTE A sendCampaign
        // Primero crear los mensajes de campaña
        const dbPath2 = path.join(process.cwd(), 'data', 'database.sqlite');
        const db2 = new sqlite3.Database(dbPath2);
        
        const queryGet2 = (sql, params = []) => new Promise((resolve, reject) => {
            db2.get(sql, params, (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
        
        const queryAll2 = (sql, params = []) => new Promise((resolve, reject) => {
            db2.all(sql, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
        
        const queryRun2 = (sql, params = []) => new Promise((resolve, reject) => {
            db2.run(sql, params, function(err) {
                if (err) reject(err);
                else resolve({ id: this.lastID, changes: this.changes });
            });
        });
        
        try {
            console.log(`🔍 [DEBUG] Iniciando preparación de campaña ${id}`);
            logger.info(`🔍 Iniciando preparación de campaña ${id}`);
            
            // Obtener filtros y destinatarios
            const filters = campaign.filters ? JSON.parse(campaign.filters) : {};
            console.log(`🔍 [DEBUG] Filtros parseados:`, filters);
            logger.info(`🔍 Filtros parseados:`, filters);
            
            const recipients = await getRecipientsByFilters(filters);
            console.log(`🔍 [DEBUG] Destinatarios obtenidos: ${recipients.total}`);
            logger.info(`👥 ${recipients.total} destinatarios para campaña ${id}`);
            
            // Crear registros de mensajes pendientes
            for (const contact of recipients.contacts) {
                await queryRun2(
                    `INSERT INTO campaign_messages (campaign_id, contact_id, phone, status)
                     VALUES (?, ?, ?, ?)`,
                    [id, contact.id, contact.phone || contact.phone_number, 'pending']
                );
            }
            
            db2.close();
            
            console.log(`🔍 [DEBUG] ${recipients.total} mensajes creados para campaña ${id}`);
            logger.info(`✅ ${recipients.total} mensajes creados para campaña ${id}`);
            
            console.log(`🔍 [DEBUG] Llamando a sendCampaign con mapeo:`, variableMapping);
            logger.info(`🔍 Llamando a sendCampaign con mapeo:`, variableMapping);
            
            // ENVIAR MENSAJES DIRECTAMENTE CON EL MAPEO
            campaignMessagingService.sendCampaign(id, variableMapping)
                .then(result => {
                    console.log(`🔍 [DEBUG] Campaña ${id} completada:`, result.stats);
                    logger.info(`✅ Campaña ${id} completada:`, result.stats);
                })
                .catch(error => {
                    console.log(`🔍 [DEBUG] Error enviando campaña ${id}:`, error.message);
                    logger.error(`❌ Error enviando campaña ${id}:`, error);
                });
            
        } catch (error) {
            console.log(`🔍 [DEBUG] Error preparando campaña ${id}:`, error.message);
            logger.error(`❌ Error preparando campaña ${id}:`, error);
            db2.close();
        }
        
        logger.info(`✅ Campaña ${id} iniciada`);
        
        res.json({
            success: true,
            message: 'Campaña iniciada correctamente',
            data: {
                id,
                status: 'sending'
            }
        });
        
    } catch (error) {
        logger.error('❌ Error enviando campaña:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor'
        });
    }
});

/**
 * GET /campaigns/:id/stats
 * Obtener estadísticas de campaña
 */
router.get('/:id/stats', async (req, res) => {
    try {
        const { id } = req.params;
        
        logger.info(`📊 GET /campaigns/${id}/stats`);
        
        const dbPath = path.join(process.cwd(), 'data', 'database.sqlite');
        const db = new sqlite3.Database(dbPath);

        const queryGet = (sql, params = []) => new Promise((resolve, reject) => {
            db.get(sql, params, (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        const queryAll = (sql, params = []) => new Promise((resolve, reject) => {
            db.all(sql, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
        
        // Obtener campaña
        const campaign = await queryGet('SELECT * FROM campaigns WHERE id = ?', [id]);
        
        if (!campaign) {
            db.close();
            return res.status(404).json({
                success: false,
                error: 'Campaña no encontrada'
            });
        }
        
        // Estadísticas de mensajes
        const messagesStats = await queryGet(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
                SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered,
                SUM(CASE WHEN status = 'read' THEN 1 ELSE 0 END) as read,
                SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending
            FROM campaign_messages
            WHERE campaign_id = ?
        `, [id]);
        
        // Mensajes recientes
        const recentMessages = await queryAll(`
            SELECT cm.*, c.name as contact_name
            FROM campaign_messages cm
            LEFT JOIN contacts c ON cm.contact_id = c.id
            WHERE cm.campaign_id = ?
            ORDER BY cm.created_at DESC
            LIMIT 10
        `, [id]);
        
        db.close();
        
        res.json({
            success: true,
            data: {
                campaign: {
                    id: campaign.id,
                    name: campaign.name,
                    status: campaign.status,
                    total_recipients: campaign.total_recipients,
                    started_at: campaign.started_at,
                    completed_at: campaign.completed_at
                },
                stats: {
                    total: messagesStats.total || 0,
                    sent: messagesStats.sent || 0,
                    delivered: messagesStats.delivered || 0,
                    read: messagesStats.read || 0,
                    failed: messagesStats.failed || 0,
                    pending: messagesStats.pending || 0,
                    success_rate: messagesStats.total > 0 
                        ? ((messagesStats.delivered || 0) / messagesStats.total * 100).toFixed(2) 
                        : 0,
                    read_rate: messagesStats.delivered > 0 
                        ? ((messagesStats.read || 0) / messagesStats.delivered * 100).toFixed(2) 
                        : 0
                },
                recent_messages: recentMessages
            }
        });
        
    } catch (error) {
        logger.error('❌ Error obteniendo estadísticas:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor'
        });
    }
});

/**
 * POST /campaigns/preview-recipients
 * Previsualizar destinatarios según filtros
 */
router.post('/preview-recipients', async (req, res) => {
    try {
        const { filters = {} } = req.body;
        
        logger.info(`👥 POST /campaigns/preview-recipients`);
        
        const recipients = await getRecipientsByFilters(filters, 50); // Límite de 50 para preview
        
        res.json({
            success: true,
            data: {
                total: recipients.total,
                contacts: recipients.contacts
            }
        });
        
    } catch (error) {
        logger.error('❌ Error previsualizando destinatarios:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor'
        });
    }
});

/**
 * Calcular número de destinatarios según filtros
 */
async function calculateRecipients(filters) {
    try {
        const recipients = await getRecipientsByFilters(filters, null);
        return recipients.total;
    } catch (error) {
        logger.error('Error calculando destinatarios:', error);
        return 0;
    }
}

/**
 * Obtener destinatarios según filtros (usando DatabaseService)
 */
async function getRecipientsByFilters(filters, limit = null) {
    try {
        const db = getDatabaseService();
        
        // Inicializar si no está inicializado
        if (!db.isInitialized) {
            await db.initialize();
        }
        
        const whereConditions = [];
        const params = [];
        
        // Solo contactos activos
        whereConditions.push('status = ?');
        params.push('active');
        
        if (filters.search) {
            whereConditions.push('(name LIKE ? OR phone LIKE ? OR email LIKE ?)');
            const searchTerm = `%${filters.search}%`;
            params.push(searchTerm, searchTerm, searchTerm);
        }
        
        if (filters.tag) {
            whereConditions.push('tags LIKE ?');
            params.push(`%${filters.tag}%`);
        }
        
        if (filters.status) {
            whereConditions.push('status = ?');
            params.push(filters.status === 'blocked' ? 'blocked' : 'active');
        }
        
        const whereClause = whereConditions.length > 0 
            ? `WHERE ${whereConditions.join(' AND ')}`
            : '';
        
        // Contar total
        const countQuery = `SELECT COUNT(*) as total FROM contacts ${whereClause}`;
        const totalResult = await db.get(countQuery, params);
        const total = totalResult ? totalResult.total : 0;
        
        // Obtener contactos
        const query = `
            SELECT id, phone_number as phone, name, email
            FROM contacts
            ${whereClause}
            ${limit ? `LIMIT ${limit}` : ''}
        `;
        
        let contacts = await db.all(query, params);
        
        // Filtrar por campo personalizado si se especifica
        if (filters.custom_field) {
            try {
                const customFieldValues = await db.findAll('custom_field_values', {
                    field_id: filters.custom_field
                });
                
                const contactIds = customFieldValues.map(v => v.contact_id);
                contacts = contacts.filter(contact => contactIds.includes(contact.id));
            } catch (err) {
                logger.warn('⚠️ Error filtrando por campos personalizados:', err.message);
            }
        }
        
        return {
            total: filters.custom_field ? contacts.length : total,
            contacts
        };
    } catch (error) {
        logger.error('Error obteniendo destinatarios:', error);
        throw error;
    }
}

/**
 * Procesar envío de campaña en segundo plano
 */
async function processCampaignSending(campaignId, campaign, variableMapping = {}) {
    const dbPath = path.join(process.cwd(), 'data', 'database.sqlite');

    try {
        logger.info(`📤 Iniciando envío de campaña ${campaignId}`);
        logger.info(`📋 Campaña recibida:`, {
            id: campaign.id,
            name: campaign.name,
            template_id: campaign.template_id,
            variable_mapping: campaign.variable_mapping
        });
        console.log(`🔍 [DEBUG processCampaignSending] Mapeo recibido:`, variableMapping);

        // Parsear filtros
        const filters = campaign.filters ? JSON.parse(campaign.filters) : {};

        // Obtener destinatarios
        const recipients = await getRecipientsByFilters(filters);

        logger.info(`👥 ${recipients.total} destinatarios para campaña ${campaignId}`);

        // Crear registros de mensajes pendientes
        const db = new sqlite3.Database(dbPath);
        
        const queryRun = (sql, params = []) => new Promise((resolve, reject) => {
            db.run(sql, params, function(err) {
                if (err) reject(err);
                else resolve({ id: this.lastID, changes: this.changes });
            });
        });
        
        for (const contact of recipients.contacts) {
            await queryRun(
                `INSERT INTO campaign_messages (campaign_id, contact_id, phone, status)
                 VALUES (?, ?, ?, ?)`,
                [campaignId, contact.id, contact.phone || contact.phone_number, 'pending']
            );
        }
        
        db.close();
        
        logger.info(`✅ ${recipients.total} mensajes creados para campaña ${campaignId}`);
        
        // Si no se pasó mapeo como parámetro, parsearlo de la campaña
        if (Object.keys(variableMapping).length === 0 && campaign.variable_mapping) {
            variableMapping = JSON.parse(campaign.variable_mapping);
        }
        
        console.log(`🔍 [DEBUG] Antes de sendCampaign - campaignId: ${campaignId}, variableMapping:`, variableMapping);
        logger.info(`📋 Variable mapping para campaña ${campaignId}:`, {
            raw: campaign.variable_mapping,
            parsed: variableMapping,
            hasMapping: Object.keys(variableMapping).length > 0
        });
        
        // ENVIAR MENSAJES USANDO EL SERVICIO DE CAMPAÑA
        // Se ejecuta en segundo plano con throttling automático
        console.log(`🔍 [DEBUG] Llamando a sendCampaign con variableMapping:`, variableMapping);
        campaignMessagingService.sendCampaign(campaignId, variableMapping)
            .then(result => {
                logger.info(`✅ Campaña ${campaignId} completada:`, result.stats);
            })
            .catch(error => {
                logger.error(`❌ Error enviando campaña ${campaignId}:`, error);
            });
        
    } catch (error) {
        logger.error(`❌ Error procesando campaña ${campaignId}:`, error);
        
        // Actualizar estado a failed
        const db = new sqlite3.Database(dbPath);
        db.run('UPDATE campaigns SET status = ? WHERE id = ?', ['failed', campaignId]);
        db.close();
    }
}

/**
 * GET /campaigns/template/:templateId/variables
 * Obtener variables de una plantilla
 */
router.get('/template/:templateId/variables', async (req, res) => {
    try {
        const { templateId } = req.params;
        
        logger.info(`📋 GET /campaigns/template/${templateId}/variables`);
        
        // Obtener plantilla de 360Dialog
        const template360 = await campaignMessagingService.getTemplateFrom360Dialog(templateId);
        
        if (!template360) {
            return res.status(404).json({
                success: false,
                error: `Plantilla ${templateId} no encontrada en 360Dialog`
            });
        }
        
        // Extraer variables
        const variables = campaignMessagingService.extractTemplateVariables(template360.components);
        
        logger.info(`✅ Variables extraídas:`, {
            templateId: templateId,
            totalVariables: variables.length,
            variables: variables
        });
        
        return res.json({
            success: true,
            data: {
                templateId: templateId,
                templateName: template360.name,
                templateStatus: template360.status,
                language: template360.language,
                variables: variables,
                totalVariables: variables.length
            }
        });
        
    } catch (error) {
        logger.error(`❌ Error obteniendo variables de plantilla:`, error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /campaigns/template/:templateId/validate-variables
 * Validar mapeo de variables
 */
router.post('/template/:templateId/validate-variables', async (req, res) => {
    try {
        const { templateId } = req.params;
        const { variables: providedVariables } = req.body;
        
        logger.info(`📋 POST /campaigns/template/${templateId}/validate-variables`);
        
        // Obtener plantilla de 360Dialog
        const template360 = await campaignMessagingService.getTemplateFrom360Dialog(templateId);
        
        if (!template360) {
            return res.status(404).json({
                success: false,
                error: `Plantilla ${templateId} no encontrada en 360Dialog`
            });
        }
        
        // Extraer variables de la plantilla
        const templateVariables = campaignMessagingService.extractTemplateVariables(template360.components);
        
        // Validar mapeo
        const validation = campaignMessagingService.validateVariableMapping(templateVariables, providedVariables);
        
        logger.info(`✅ Validación de variables:`, {
            templateId: templateId,
            valid: validation.valid,
            errors: validation.errors
        });
        
        return res.json({
            success: validation.valid,
            data: {
                templateId: templateId,
                valid: validation.valid,
                errors: validation.errors,
                templateVariables: templateVariables
            }
        });
        
    } catch (error) {
        logger.error(`❌ Error validando variables:`, error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /templates/:templateId
 * Obtener una plantilla por ID
 */
router.get('/templates/:templateId', async (req, res) => {
    try {
        const { templateId } = req.params;
        
        logger.info(`📋 GET /templates/${templateId}`);
        
        // Obtener plantilla de 360Dialog
        const template360 = await campaignMessagingService.getTemplateFrom360Dialog(templateId);
        
        if (!template360) {
            return res.status(404).json({
                success: false,
                error: `Plantilla ${templateId} no encontrada en 360Dialog`
            });
        }
        
        // Extraer variables
        const variables = campaignMessagingService.extractTemplateVariables(template360.components);
        
        logger.info(`✅ Plantilla obtenida:`, {
            templateId: templateId,
            templateName: template360.name,
            totalVariables: variables.length
        });
        
        return res.json({
            success: true,
            data: {
                id: templateId,
                name: template360.name,
                status: template360.status,
                language: template360.language,
                components: template360.components,
                variables: variables,
                totalVariables: variables.length
            }
        });
        
    } catch (error) {
        logger.error(`❌ Error obteniendo plantilla:`, error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

export default router;

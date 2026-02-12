/**
 * Campaign Messaging Service
 * Servicio especializado para envío masivo de campañas con throttling
 * Integrado con 360Dialog API
 */

import { unified360DialogService } from '../core/core/Unified360DialogService.js';
import { createLogger } from '../core/core/logger.js';
import sqlite3 from 'sqlite3';
import path from 'path';
import EventEmitter from 'events';

const logger = createLogger('CAMPAIGN_MESSAGING');

class CampaignMessagingService extends EventEmitter {
    constructor() {
        super();
        
        // Configuración de throttling para envío masivo
        this.throttleConfig = {
            messagesPerMinute: 60,      // Límite de mensajes por minuto
            messagesPerSecond: 1,        // Mensajes por segundo
            delayBetweenMessages: 1000,  // 1 segundo entre mensajes
            batchSize: 10,               // Procesar en lotes de 10
            maxRetries: 3                // Reintentos por mensaje
        };
        
        // Estado del servicio
        this.activeCampaigns = new Map();
        this.isProcessing = false;
        
        // Métricas
        this.metrics = {
            totalSent: 0,
            totalFailed: 0,
            totalDelivered: 0,
            totalRead: 0,
            campaignsProcessed: 0
        };
        
        logger.info('✅ Campaign Messaging Service initialized');
    }
    
    /**
     * Obtener conexión a base de datos
     */
    getDbConnection() {
        const dbPath = path.join(process.cwd(), 'data', 'database.sqlite');
        return new sqlite3.Database(dbPath);
    }
    
    /**
     * Helper para ejecutar queries
     */
    dbRun(db, sql, params = []) {
        return new Promise((resolve, reject) => {
            db.run(sql, params, function(err) {
                if (err) reject(err);
                else resolve({ id: this.lastID, changes: this.changes });
            });
        });
    }
    
    dbGet(db, sql, params = []) {
        return new Promise((resolve, reject) => {
            db.get(sql, params, (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    }
    
    dbAll(db, sql, params = []) {
        return new Promise((resolve, reject) => {
            db.all(sql, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
    }
    
    /**
     * Enviar campaña completa
     */
    async sendCampaign(campaignId, variableMapping = {}) {
        const db = this.getDbConnection();
        
        try {
            console.log(`🔍 [DEBUG sendCampaign] campaignId: ${campaignId}`);
            console.log(`🔍 [DEBUG sendCampaign] variableMapping recibido:`, variableMapping);
            console.log(`🔍 [DEBUG sendCampaign] variableMapping keys:`, Object.keys(variableMapping));
            console.log(`🔍 [DEBUG sendCampaign] variableMapping length:`, Object.keys(variableMapping).length);
            
            logger.info(`📤 Starting campaign ${campaignId}`);
            logger.info(`📋 Variable mapping recibido en sendCampaign:`, {
                hasMapping: Object.keys(variableMapping).length > 0,
                mappingKeys: Object.keys(variableMapping),
                fullMapping: variableMapping
            });
            
            // Verificar si ya se está procesando
            if (this.activeCampaigns.has(campaignId)) {
                throw new Error('Campaign is already being processed');
            }
            
            // Obtener campaña
            const campaign = await this.dbGet(db, 
                'SELECT * FROM campaigns WHERE id = ?', 
                [campaignId]
            );
            
            if (!campaign) {
                throw new Error('Campaign not found');
            }
            
            if (campaign.status === 'sent') {
                throw new Error('Campaign already sent');
            }
            
            logger.info(`📋 Campaign variable_mapping en BD:`, campaign.variable_mapping);
            
            // IMPORTANTE: SIEMPRE usar el mapeo de la BD, no el parámetro
            // Esto asegura que el mapeo NUNCA se pierda
            if (campaign.variable_mapping) {
                try {
                    variableMapping = JSON.parse(campaign.variable_mapping);
                    console.log(`🔍 [DEBUG] Variable mapping cargado desde BD:`, variableMapping);
                    logger.info(`📋 Variable mapping cargado desde BD:`, variableMapping);
                } catch (e) {
                    logger.warn('Could not parse variable_mapping from campaign');
                    variableMapping = {};
                }
            } else {
                logger.warn('⚠️ Campaign has no variable_mapping in database');
                variableMapping = {};
            }
            
            console.log(`🔍 [DEBUG] Final variable mapping:`, variableMapping);
            console.error(`🔍🔍🔍 [CRITICAL] Campaign ${campaignId} - Final variable mapping:`, JSON.stringify(variableMapping));
            logger.info(`📋 Final variable mapping:`, {
                hasMapping: Object.keys(variableMapping).length > 0,
                mappingKeys: Object.keys(variableMapping),
                fullMapping: variableMapping
            });
            
            // Actualizar estado a "sending" solo si no está ya en ese estado
            if (campaign.status !== 'sending') {
                await this.dbRun(db, 
                    'UPDATE campaigns SET status = ?, started_at = CURRENT_TIMESTAMP WHERE id = ?',
                    ['sending', campaignId]
                );
            }
            
            // Obtener mensajes pendientes CON DATOS DEL CONTACTO
            const messages = await this.dbAll(db,
                `SELECT cm.*, c.name, c.last_name, c.email, c.phone_number as contact_phone
                 FROM campaign_messages cm
                 LEFT JOIN contacts c ON cm.contact_id = c.id
                 WHERE cm.campaign_id = ? AND cm.status = ?`,
                [campaignId, 'pending']
            );
            
            logger.info(`📊 Found ${messages.length} messages to send for campaign ${campaignId}`);
            
            // Marcar como activa
            this.activeCampaigns.set(campaignId, {
                id: campaignId,
                name: campaign.name,
                total: messages.length,
                sent: 0,
                failed: 0,
                startTime: Date.now()
            });
            
            // Procesar mensajes en lotes con throttling
            await this.processMessagesWithThrottling(campaign, messages, db, variableMapping);
            
            // Actualizar campaña como completada
            const finalStats = await this.calculateCampaignStats(campaignId, db);
            
            await this.dbRun(db,
                `UPDATE campaigns 
                 SET status = ?, completed_at = CURRENT_TIMESTAMP,
                     sent_count = ?, delivered_count = ?, read_count = ?, failed_count = ?
                 WHERE id = ?`,
                ['sent', finalStats.sent, finalStats.delivered, finalStats.read, 
                 finalStats.failed, campaignId]
            );
            
            // Limpiar de activas
            this.activeCampaigns.delete(campaignId);
            
            logger.info(`✅ Campaign ${campaignId} completed: ${finalStats.sent} sent, ${finalStats.failed} failed`);
            
            this.emit('campaign:completed', {
                campaignId,
                stats: finalStats,
                duration: Date.now() - this.activeCampaigns.get(campaignId)?.startTime
            });
            
            return {
                success: true,
                stats: finalStats
            };
            
        } catch (error) {
            logger.error(`❌ Error sending campaign ${campaignId}:`, error);
            
            // Actualizar como fallida
            await this.dbRun(db,
                'UPDATE campaigns SET status = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?',
                ['failed', campaignId]
            );
            
            this.activeCampaigns.delete(campaignId);
            
            throw error;
        } finally {
            db.close();
        }
    }
    
    /**
     * Procesar mensajes con throttling (control de velocidad)
     */
    async processMessagesWithThrottling(campaign, messages, db, variableMapping = {}) {
        const { messagesPerSecond, delayBetweenMessages, batchSize } = this.throttleConfig;
        
        console.error(`🔍🔍🔍 [CRITICAL] processMessagesWithThrottling - Campaign ${campaign.id} - variableMapping:`, JSON.stringify(variableMapping));
        
        // Dividir en lotes
        const batches = this.chunkArray(messages, batchSize);
        
        logger.info(`📦 Processing ${batches.length} batches of ${batchSize} messages`);
        
        for (let i = 0; i < batches.length; i++) {
            const batch = batches[i];
            const batchStartTime = Date.now();
            
            logger.info(`📤 Processing batch ${i + 1}/${batches.length}`);
            
            // Procesar lote
            const batchResults = await Promise.allSettled(
                batch.map(message => this.sendSingleMessage(campaign, message, db, 0, variableMapping))
            );
            
            // Actualizar estado de campaña activa
            const campaignState = this.activeCampaigns.get(campaign.id);
            if (campaignState) {
                batchResults.forEach(result => {
                    if (result.status === 'fulfilled') {
                        campaignState.sent++;
                    } else {
                        campaignState.failed++;
                    }
                });
            }
            
            // Emitir progreso
            this.emit('campaign:progress', {
                campaignId: campaign.id,
                batch: i + 1,
                totalBatches: batches.length,
                processed: (i + 1) * batchSize,
                total: messages.length,
                ...campaignState
            });
            
            // Aplicar throttling: esperar entre lotes
            const batchDuration = Date.now() - batchStartTime;
            const minBatchDuration = (batchSize / messagesPerSecond) * 1000;
            
            if (batchDuration < minBatchDuration) {
                const waitTime = minBatchDuration - batchDuration;
                logger.info(`⏳ Throttling: waiting ${waitTime}ms before next batch`);
                await this.sleep(waitTime);
            }
        }
    }
    
    /**
     * Enviar un solo mensaje de campaña
     */
    async sendSingleMessage(campaign, messageRecord, db, retryCount = 0, variableMapping = {}) {
        try {
            // SOLUCIÓN DEFINITIVA: Cargar el mapeo DIRECTAMENTE desde la BD
            // Esto elimina la dependencia del parámetro que se está perdiendo
            if (campaign.variable_mapping) {
                try {
                    variableMapping = JSON.parse(campaign.variable_mapping);
                    console.error(`🔍🔍🔍 [CRITICAL] sendSingleMessage - Campaign ${campaign.id} - variableMapping cargado desde BD:`, JSON.stringify(variableMapping));
                } catch (e) {
                    console.error(`❌ Error parseando variable_mapping en sendSingleMessage:`, e.message);
                    variableMapping = {};
                }
            } else {
                console.error(`⚠️ Campaign ${campaign.id} no tiene variable_mapping en BD`);
                variableMapping = {};
            }
            
            logger.info(`📨 Sending message to ${messageRecord.phone}`);
            
            let result;
            
            // Si hay template_id, enviar como plantilla
            if (campaign.template_id) {
                logger.info(`📋 Enviando plantilla ${campaign.template_id} a ${messageRecord.phone}`);
                
                // Obtener información de la plantilla de 360Dialog
                const template360 = await this.getTemplateFrom360Dialog(campaign.template_id);
                
                if (!template360) {
                    throw new Error(`Plantilla ${campaign.template_id} no encontrada en 360Dialog`);
                }
                
                logger.info(`📋 Detalles de plantilla desde 360Dialog:`, {
                    name: template360.name,
                    status: template360.status,
                    language: template360.language,
                    hasComponents: !!template360.components,
                    componentsCount: template360.components ? template360.components.length : 0
                });
                
                // Sincronizar plantilla en BD
                await this.syncTemplateToDatabase(db, template360);
                
                // Validar si la plantilla tiene variables
                const hasVariables = template360.components && 
                    template360.components.some(comp => 
                        comp.text && comp.text.includes('{{')
                    );
                
                if (hasVariables && Object.keys(variableMapping).length === 0) {
                    logger.warn(`⚠️ Plantilla tiene variables pero no se proporcionó mapeo`);
                    throw new Error(`Plantilla ${campaign.template_id} requiere variables`);
                }
                
                // Preparar opciones para envío de plantilla
                const templateOptions = { 
                    useQueue: false,
                    // IMPORTANTE: Usar el idioma de la plantilla desde 360Dialog
                    language: template360.language || 'es'
                };
                
                console.error(`🔍 [LANGUAGE] Usando idioma de plantilla: ${template360.language}`);
                logger.info(`🌐 Idioma de plantilla: ${template360.language}`);
                
                // Construir TODOS los componentes de la plantilla CON VARIABLES
                const builtComponents = this.buildTemplateComponents(template360.components, variableMapping, messageRecord);
                
                if (builtComponents && builtComponents.length > 0) {
                    templateOptions.components = builtComponents;
                    logger.info(`📦 Componentes de plantilla construidos (${builtComponents.length} componentes)`);
                }
                
                // Si la plantilla tiene variables, preparar el mapeo
                if (hasVariables && Object.keys(variableMapping).length > 0) {
                    templateOptions.variables = variableMapping;
                    logger.info(`📦 Variables de plantilla agregadas:`, variableMapping);
                }
                
                // El template_id es el nombre de la plantilla en 360Dialog
                result = await unified360DialogService.sendTemplate(
                    messageRecord.phone,
                    campaign.template_id,  // Este es el nombre de la plantilla
                    templateOptions
                );
            } else if (campaign.message) {
                // Si no hay template, enviar como mensaje de texto
                logger.info(`💬 Enviando mensaje de texto a ${messageRecord.phone}`);
                
                result = await unified360DialogService.sendTextMessage(
                    messageRecord.phone,
                    campaign.message,
                    { useQueue: false }
                );
            } else {
                throw new Error('No message content or template found');
            }
            
            // Actualizar registro en BD
            await this.dbRun(db,
                `UPDATE campaign_messages 
                 SET status = ?, message_id = ?, sent_at = CURRENT_TIMESTAMP
                 WHERE id = ?`,
                ['sent', result.messageId, messageRecord.id]
            );
            
            logger.info(`✅ Message sent to ${messageRecord.phone}: ${result.messageId}`);
            
            return {
                success: true,
                messageId: result.messageId,
                phone: messageRecord.phone
            };
            
        } catch (error) {
            logger.error(`❌ Failed to send message to ${messageRecord.phone}:`, error.message);
            
            // Reintentar si no se ha excedido el límite
            if (retryCount < this.throttleConfig.maxRetries) {
                logger.info(`🔄 Retrying message to ${messageRecord.phone} (${retryCount + 1}/${this.throttleConfig.maxRetries})`);
                await this.sleep(2000 * (retryCount + 1)); // Esperar más en cada reintento
                return this.sendSingleMessage(campaign, messageRecord, db, retryCount + 1);
            }
            
            // Marcar como fallido
            await this.dbRun(db,
                `UPDATE campaign_messages 
                 SET status = ?, error_message = ?, failed_at = CURRENT_TIMESTAMP
                 WHERE id = ?`,
                ['failed', error.message, messageRecord.id]
            );
            
            throw error;
        }
    }
    
    /**
     * Calcular estadísticas de campaña
     */
    async calculateCampaignStats(campaignId, db) {
        const stats = await this.dbGet(db, `
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'sent' OR status = 'delivered' OR status = 'read' THEN 1 ELSE 0 END) as sent,
                SUM(CASE WHEN status = 'delivered' OR status = 'read' THEN 1 ELSE 0 END) as delivered,
                SUM(CASE WHEN status = 'read' THEN 1 ELSE 0 END) as read,
                SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
            FROM campaign_messages
            WHERE campaign_id = ?
        `, [campaignId]);
        
        return {
            total: stats.total || 0,
            sent: stats.sent || 0,
            delivered: stats.delivered || 0,
            read: stats.read || 0,
            failed: stats.failed || 0
        };
    }
    
    /**
     * Actualizar estado de mensaje desde webhook
     */
    async updateMessageStatus(messageId, status, timestamp = null) {
        const db = this.getDbConnection();
        
        try {
            const statusField = `${status}_at`;
            const validStatuses = ['sent', 'delivered', 'read', 'failed'];
            
            if (!validStatuses.includes(status)) {
                logger.warn(`⚠️ Invalid message status: ${status}`);
                return;
            }
            
            // Actualizar mensaje
            await this.dbRun(db,
                `UPDATE campaign_messages 
                 SET status = ?, ${statusField} = ? 
                 WHERE message_id = ?`,
                [status, timestamp || new Date().toISOString(), messageId]
            );
            
            // Obtener campaña asociada
            const message = await this.dbGet(db,
                'SELECT campaign_id FROM campaign_messages WHERE message_id = ?',
                [messageId]
            );
            
            if (message) {
                // Actualizar estadísticas de campaña
                const stats = await this.calculateCampaignStats(message.campaign_id, db);
                
                await this.dbRun(db,
                    `UPDATE campaigns 
                     SET sent_count = ?, delivered_count = ?, read_count = ?, failed_count = ?
                     WHERE id = ?`,
                    [stats.sent, stats.delivered, stats.read, stats.failed, message.campaign_id]
                );
            }
            
            logger.info(`📊 Updated message ${messageId} status to ${status}`);
            
        } catch (error) {
            logger.error(`❌ Error updating message status:`, error);
        } finally {
            db.close();
        }
    }
    
    /**
     * Obtener estado de campaña activa
     */
    getCampaignStatus(campaignId) {
        return this.activeCampaigns.get(campaignId) || null;
    }
    
    /**
     * Detener campaña en curso
     */
    async stopCampaign(campaignId) {
        const db = this.getDbConnection();
        
        try {
            if (!this.activeCampaigns.has(campaignId)) {
                throw new Error('Campaign is not active');
            }
            
            logger.info(`🛑 Stopping campaign ${campaignId}`);
            
            // Actualizar estado
            await this.dbRun(db,
                'UPDATE campaigns SET status = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?',
                ['stopped', campaignId]
            );
            
            // Cancelar mensajes pendientes
            await this.dbRun(db,
                `UPDATE campaign_messages 
                 SET status = 'cancelled' 
                 WHERE campaign_id = ? AND status = 'pending'`,
                [campaignId]
            );
            
            this.activeCampaigns.delete(campaignId);
            
            logger.info(`✅ Campaign ${campaignId} stopped`);
            
            return { success: true };
            
        } catch (error) {
            logger.error(`❌ Error stopping campaign:`, error);
            throw error;
        } finally {
            db.close();
        }
    }
    
    /**
     * Dividir array en chunks
     */
    chunkArray(array, size) {
        const chunks = [];
        for (let i = 0; i < array.length; i += size) {
            chunks.push(array.slice(i, i + size));
        }
        return chunks;
    }
    
    /**
     * Sleep helper
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    /**
     * Obtener métricas del servicio
     */
    getMetrics() {
        return {
            ...this.metrics,
            activeCampaigns: Array.from(this.activeCampaigns.values()),
            timestamp: new Date().toISOString()
        };
    }
    
    /**
     * Construir componentes para plantillas - Adaptación automática a cualquier tipo
     * Soporta: HEADER (texto/imagen), BODY, FOOTER, BUTTONS (FLOW/URL/QUICK_REPLY)
     */
    buildTemplateComponents(components, variableMapping = {}, messageRecord = {}) {
        try {
            if (!components || !Array.isArray(components)) {
                return null;
            }
            
            const builtComponents = [];
            
            logger.info(`📦 Procesando ${components.length} componentes de plantilla`);
            logger.info(`📋 Variable mapping disponible:`, {
                hasMapping: Object.keys(variableMapping).length > 0,
                mappingKeys: Object.keys(variableMapping)
            });
            
            // IMPORTANTE: Detectar si hay HEADER con IMAGE/VIDEO/DOCUMENT
            // Si es así, SOLO incluir BODY (la imagen y botones se obtienen de la plantilla)
            const hasMediaHeader = components.some(comp => 
                comp.type === 'HEADER' && (comp.format === 'IMAGE' || comp.format === 'VIDEO' || comp.format === 'DOCUMENT')
            );
            
            if (hasMediaHeader) {
                logger.info(`📦 Plantilla con HEADER MEDIA detectada - SOLO incluir BODY`);
            }
            
            // Procesar cada componente de la plantilla
            components.forEach((comp, index) => {
                logger.info(`📦 Componente ${index}: type=${comp.type}, format=${comp.format || 'N/A'}`);
                
                if (comp.type === 'HEADER') {
                    // HEADER: Incluir siempre
                    // - Si es TEXT con variables: incluir con parámetros
                    // - Si es IMAGE/VIDEO/DOCUMENT: incluir SIN parámetros (360Dialog lo obtiene de la plantilla)
                    if (comp.format === 'TEXT' && comp.text && comp.text.includes('{{')) {
                        // HEADER TEXT con variables
                        const headerComponent = this.buildHeaderComponent(comp, variableMapping, messageRecord);
                        if (headerComponent && headerComponent.parameters && headerComponent.parameters.length > 0) {
                            builtComponents.push(headerComponent);
                            logger.info(`✅ HEADER TEXT construido con variables`);
                        }
                    } else if (comp.format === 'IMAGE' || comp.format === 'VIDEO' || comp.format === 'DOCUMENT') {
                        // HEADER con MEDIA: incluir con URL o media_id
                        // 360Dialog requiere que el HEADER esté en el payload con la URL completa
                        // NOTA: Puedes usar:
                        // 1. URL pública válida (link)
                        // 2. media_id de una imagen subida a 360Dialog (id)
                        // 3. URL del ejemplo de la plantilla (header_handle)
                        // Para plantillas especiales (Limited-Time Offer), usa media_id
                        
                        let mediaUrl = null;
                        if (comp.example && comp.example.header_handle && comp.example.header_handle.length > 0) {
                            mediaUrl = comp.example.header_handle[0];
                        }
                        
                        if (mediaUrl) {
                            const mediaType = comp.format.toLowerCase(); // 'image', 'video', 'document'
                            const headerComponent = {
                                type: 'header',
                                parameters: [
                                    {
                                        type: mediaType,
                                        [mediaType]: {
                                            link: mediaUrl
                                        }
                                    }
                                ]
                            };
                            builtComponents.push(headerComponent);
                            logger.info(`✅ HEADER ${comp.format} construido con URL del ejemplo`);
                        } else {
                            logger.warn(`⚠️ HEADER ${comp.format} no tiene URL en example`);
                        }
                    } else {
                        logger.info(`⏭️ HEADER omitido: no tiene variables ni media`);
                    }
                    
                } else if (comp.type === 'BODY') {
                    // Procesar BODY - puede tener variables
                    const bodyComponent = this.buildBodyComponent(comp, variableMapping, messageRecord);
                    if (bodyComponent && bodyComponent.parameters && bodyComponent.parameters.length > 0) {
                        builtComponents.push(bodyComponent);
                        logger.info(`✅ BODY construido con ${bodyComponent.parameters.length} parámetros`);
                    }
                    
                } else if (comp.type === 'FOOTER') {
                    // FOOTER: Solo incluir si tiene variables
                    if (comp.text && comp.text.includes('{{')) {
                        const footerComponent = this.buildFooterComponent(comp, variableMapping, messageRecord);
                        if (footerComponent && footerComponent.parameters && footerComponent.parameters.length > 0) {
                            builtComponents.push(footerComponent);
                            logger.info(`✅ FOOTER construido`);
                        }
                    } else {
                        logger.info(`⏭️ FOOTER omitido: no tiene variables`);
                    }
                    
                } else if (comp.type === 'BUTTONS') {
                    // BUTTONS: No incluir en el payload - 360Dialog los obtiene de la plantilla
                    logger.info(`⏭️ BUTTONS omitido: se obtienen de la plantilla`);
                }
            });
            
            logger.info(`📦 Total de componentes construidos: ${builtComponents.length}`);
            logger.info(`📦 COMPONENTES FINALES:`, JSON.stringify(builtComponents, null, 2));
            return builtComponents.length > 0 ? builtComponents : null;
            
        } catch (error) {
            logger.error(`❌ Error construyendo componentes de plantilla:`, error.message);
            return null;
        }
    }
    
    /**
     * Construir componente HEADER - Adaptable a TEXTO, IMAGEN, VIDEO, DOCUMENTO
     */
    buildHeaderComponent(comp, variableMapping = {}, messageRecord = {}) {
        try {
            const headerComponent = {
                type: 'header'
            };
            
            // 360Dialog no requiere parámetros en el payload para HEADER
            // Los parámetros están definidos en la plantilla
            
            logger.info(`📦 HEADER: format=${comp.format}`);
            return headerComponent;
            
        } catch (error) {
            logger.error(`❌ Error en HEADER:`, error.message);
            return null;
        }
    }
    
    /**
     * Construir componente HEADER con MEDIA (IMAGE/VIDEO/DOCUMENT)
     * IMPORTANTE: Las URLs del ejemplo de WhatsApp requieren autenticación y expiran
     * Por eso NO se incluyen parámetros de media en el payload
     * 360Dialog obtiene la media de la plantilla almacenada
     */
    buildMediaHeaderComponent(comp) {
        try {
            // SOLUCIÓN: No incluir parámetros de media
            // 360Dialog usa la media almacenada en la plantilla
            // Los parámetros de media en el payload causarían errores 403 Forbidden
            
            const headerComponent = {
                type: 'header'
                // NO incluir parameters - 360Dialog obtiene la media de la plantilla
            };
            
            logger.info(`📦 HEADER ${comp.format} construido (media obtenida de la plantilla)`);
            
            return headerComponent;
            
        } catch (error) {
            logger.error(`❌ Error en HEADER MEDIA:`, error.message);
            return null;
        }
    }
    
    /**
     * Construir componente BODY - Maneja variables dinámicamente
     */
    buildBodyComponent(comp, variableMapping = {}, messageRecord = {}) {
        try {
            const bodyComponent = {
                type: 'body',
                parameters: []
            };
            
            // Si hay texto con variables, reemplazarlas
            if (comp.text && comp.text.includes('{{')) {
                // Extraer números de variables {{1}}, {{2}}, etc.
                const varMatches = comp.text.match(/\{\{(\d+)\}\}/g);
                
                if (varMatches && Object.keys(variableMapping).length > 0) {
                    varMatches.forEach(match => {
                        const varNum = match.replace(/\D/g, ''); // Extraer número
                        const varConfig = variableMapping[varNum];
                        
                        if (varConfig && varConfig.type) {
                            let value = '';
                            
                            // Obtener valor según el tipo de variable
                            if (varConfig.type === 'name') {
                                value = messageRecord.name || '[name]';
                            } else if (varConfig.type === 'last_name') {
                                value = messageRecord.last_name || '[last_name]';
                            } else if (varConfig.type === 'phone') {
                                value = messageRecord.phone || '[phone]';
                            } else if (varConfig.type === 'email') {
                                value = messageRecord.email || '[email]';
                            } else {
                                value = `[${varConfig.type}]`;
                            }
                            
                            bodyComponent.parameters.push({
                                type: 'text',
                                text: value
                            });
                            
                            logger.info(`📝 Variable {{${varNum}}} = ${value}`);
                        }
                    });
                }
            }
            
            logger.info(`📦 BODY: ${bodyComponent.parameters.length} parámetros`);
            
            // IMPORTANTE: Solo retornar si hay parámetros
            return bodyComponent.parameters.length > 0 ? bodyComponent : null;
            
        } catch (error) {
            logger.error(`❌ Error en BODY:`, error.message);
            return null;
        }
    }
    
    /**
     * Extraer todas las variables de una plantilla
     * Retorna array con información de cada variable
     */
    extractTemplateVariables(components) {
        try {
            const variables = [];
            
            if (!components || !Array.isArray(components)) {
                return variables;
            }
            
            // Buscar variables en cada componente
            components.forEach((comp, compIndex) => {
                if (comp.type === 'HEADER' && comp.text && comp.text.includes('{{')) {
                    const matches = comp.text.match(/\{\{(\d+)\}\}/g);
                    if (matches) {
                        matches.forEach((match) => {
                            const varNum = match.replace(/\D/g, '');
                            if (!variables.find(v => v.number === varNum)) {
                                variables.push({
                                    number: varNum,
                                    placeholder: match,
                                    location: 'HEADER',
                                    type: null,  // Usuario debe elegir
                                    required: true,
                                    example: ''
                                });
                            }
                        });
                    }
                }
                
                if (comp.type === 'BODY' && comp.text && comp.text.includes('{{')) {
                    const matches = comp.text.match(/\{\{(\d+)\}\}/g);
                    if (matches) {
                        matches.forEach((match) => {
                            const varNum = match.replace(/\D/g, '');
                            if (!variables.find(v => v.number === varNum)) {
                                variables.push({
                                    number: varNum,
                                    placeholder: match,
                                    location: 'BODY',
                                    type: null,  // Usuario debe elegir
                                    required: true,
                                    example: ''
                                });
                            }
                        });
                    }
                }
                
                if (comp.type === 'FOOTER' && comp.text && comp.text.includes('{{')) {
                    const matches = comp.text.match(/\{\{(\d+)\}\}/g);
                    if (matches) {
                        matches.forEach((match) => {
                            const varNum = match.replace(/\D/g, '');
                            if (!variables.find(v => v.number === varNum)) {
                                variables.push({
                                    number: varNum,
                                    placeholder: match,
                                    location: 'FOOTER',
                                    type: null,  // Usuario debe elegir
                                    required: true,
                                    example: ''
                                });
                            }
                        });
                    }
                }
            });
            
            // Ordenar por número de variable
            variables.sort((a, b) => parseInt(a.number) - parseInt(b.number));
            
            logger.info(`📦 Variables extraídas de plantilla:`, {
                total: variables.length,
                variables: variables.map(v => ({
                    number: v.number,
                    placeholder: v.placeholder,
                    location: v.location
                }))
            });
            
            return variables;
            
        } catch (error) {
            logger.error(`❌ Error extrayendo variables:`, error.message);
            return [];
        }
    }
    
    /**
     * Validar que todas las variables requeridas tengan mapeo
     */
    validateVariableMapping(templateVariables, providedVariables) {
        try {
            const errors = [];
            
            if (!templateVariables || templateVariables.length === 0) {
                return { valid: true, errors: [] };
            }
            
            if (!providedVariables || typeof providedVariables !== 'object') {
                return {
                    valid: false,
                    errors: [`Se requiere mapeo de variables. Variables esperadas: {{${templateVariables.map(v => v.number).join('}}, {{')}}}}`]
                };
            }
            
            // Validar cada variable requerida
            templateVariables.forEach(templateVar => {
                if (templateVar.required) {
                    const varKey = `variable_${templateVar.number}`;
                    
                    if (!providedVariables[varKey]) {
                        errors.push(`Variable {{${templateVar.number}}} es obligatoria (ubicada en ${templateVar.location})`);
                    } else {
                        const mapping = providedVariables[varKey];
                        
                        // Validar que tenga tipo
                        if (!mapping.type) {
                            errors.push(`Variable {{${templateVar.number}}} debe tener un tipo definido`);
                        }
                        
                        // Validar que tenga valor
                        if (!mapping.value && mapping.value !== 0) {
                            errors.push(`Variable {{${templateVar.number}}} debe tener un valor`);
                        }
                    }
                }
            });
            
            return {
                valid: errors.length === 0,
                errors: errors
            };
            
        } catch (error) {
            logger.error(`❌ Error validando mapeo de variables:`, error.message);
            return {
                valid: false,
                errors: [error.message]
            };
        }
    }
    
    /**
     * Construir componente FOOTER
     */
    buildFooterComponent(comp, variableMapping = {}, messageRecord = {}) {
        try {
            const footerComponent = {
                type: 'footer',
                parameters: []
            };
            
            return footerComponent;
            
        } catch (error) {
            logger.error(`❌ Error en FOOTER:`, error.message);
            return null;
        }
    }
    
    /**
     * Construir datos de BUTTON para incluir en el componente BUTTONS
     */
    buildButtonData(button, buttonIndex, variableMapping = {}, messageRecord = {}) {
        try {
            logger.info(`📦 Procesando BUTTON: type=${button.type}, text=${button.text}`);
            
            if (button.type === 'FLOW') {
                // FLOW BUTTON
                return {
                    type: 'flow',
                    text: button.text,
                    flow_id: button.flow_id
                };
                
            } else if (button.type === 'URL') {
                // URL BUTTON
                return {
                    type: 'url',
                    text: button.text,
                    url: button.url || 'https://example.com'
                };
                
            } else if (button.type === 'PHONE_NUMBER') {
                // PHONE NUMBER BUTTON
                return {
                    type: 'phone_number',
                    text: button.text,
                    phone_number: button.phone_number || '+1234567890'
                };
                
            } else if (button.type === 'QUICK_REPLY') {
                // QUICK REPLY BUTTON
                return {
                    type: 'quick_reply',
                    text: button.text,
                    id: button.id || button.payload || button.text
                };
                
            } else {
                logger.warn(`⚠️ Tipo de botón no reconocido: ${button.type}`);
                return null;
            }
            
        } catch (error) {
            logger.error(`❌ Error en BUTTON:`, error.message);
            return null;
        }
    }
    
    /**
     * Construir componente BUTTON - Adaptable a FLOW, URL, QUICK_REPLY, PHONE_NUMBER, etc.
     * DEPRECATED: Usar buildButtonData en su lugar
     */
    buildButtonComponent(button, componentIndex, variableMapping = {}, messageRecord = {}) {
        try {
            logger.info(`📦 Procesando BUTTON (DEPRECATED): type=${button.type}, text=${button.text}`);
            
            if (button.type === 'FLOW') {
                // FLOW BUTTON
                return {
                    type: 'button',
                    sub_type: 'flow',
                    index: '0',
                    parameters: [
                        {
                            type: 'action',
                            action: {
                                flow_token: 'FLOW_TOKEN'
                            }
                        }
                    ]
                };
                
            } else if (button.type === 'URL') {
                // URL BUTTON
                return {
                    type: 'button',
                    sub_type: 'url',
                    index: '0',
                    parameters: [
                        {
                            type: 'action',
                            action: {
                                url: button.url || 'https://example.com'
                            }
                        }
                    ]
                };
                
            } else if (button.type === 'PHONE_NUMBER') {
                // PHONE NUMBER BUTTON
                return {
                    type: 'button',
                    sub_type: 'phone_number',
                    index: '0',
                    parameters: [
                        {
                            type: 'action',
                            action: {
                                phone_number: button.phone_number || '+1234567890'
                            }
                        }
                    ]
                };
                
            } else if (button.type === 'QUICK_REPLY') {
                // QUICK REPLY BUTTON
                return {
                    type: 'button',
                    sub_type: 'quick_reply',
                    index: '0',
                    parameters: [
                        {
                            type: 'payload',
                            payload: button.payload || button.text
                        }
                    ]
                };
                
            } else {
                logger.warn(`⚠️ Tipo de botón no reconocido: ${button.type}`);
                return null;
            }
            
        } catch (error) {
            logger.error(`❌ Error en BUTTON:`, error.message);
            return null;
        }
    }
    
    /**
     * Obtener plantilla de 360Dialog
     */
    async getTemplateFrom360Dialog(templateName) {
        try {
            const DIALOG360_API_KEY = process.env.D360_API_KEY;
            const WABA_API_BASE = process.env.D360_API_BASE || 'https://waba-v2.360dialog.io';
            
            if (!DIALOG360_API_KEY) {
                logger.warn(`⚠️ D360_API_KEY no configurada`);
                return null;
            }
            
            const response = await fetch(`${WABA_API_BASE}/v1/configs/templates`, {
                method: 'GET',
                headers: {
                    'D360-API-KEY': DIALOG360_API_KEY,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                logger.error(`❌ Error obteniendo plantillas de 360Dialog: ${response.status}`);
                return null;
            }
            
            const data = await response.json();
            const templates = data.waba_templates || [];
            
            // Buscar la plantilla por nombre
            const template = templates.find(t => t.name === templateName);
            
            if (template) {
                logger.info(`✅ Plantilla ${templateName} encontrada en 360Dialog`);
            } else {
                logger.warn(`⚠️ Plantilla ${templateName} no encontrada en 360Dialog`);
            }
            
            return template;
            
        } catch (error) {
            logger.error(`❌ Error obteniendo plantilla de 360Dialog:`, error.message);
            return null;
        }
    }
    
    /**
     * Sincronizar plantilla en la base de datos
     */
    async syncTemplateToDatabase(db, template360) {
        try {
            if (!template360) return;
            
            // Verificar si la plantilla ya existe
            const existing = await this.dbGet(db,
                'SELECT id FROM templates WHERE name = ?',
                [template360.name]
            );
            
            const componentsJson = JSON.stringify(template360.components || []);
            const languageCode = template360.language || 'es_CO';
            const status = template360.status || 'approved';
            
            if (existing) {
                // Actualizar plantilla existente
                await this.dbRun(db,
                    `UPDATE templates 
                     SET components = ?, language = ?, status = ?, updated_at = CURRENT_TIMESTAMP
                     WHERE name = ?`,
                    [componentsJson, languageCode, status, template360.name]
                );
                logger.info(`✅ Plantilla ${template360.name} actualizada en BD`);
            } else {
                // Insertar nueva plantilla
                await this.dbRun(db,
                    `INSERT INTO templates (name, components, language, status, created_at, updated_at)
                     VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
                    [template360.name, componentsJson, languageCode, status]
                );
                logger.info(`✅ Plantilla ${template360.name} insertada en BD`);
            }
            
        } catch (error) {
            logger.error(`❌ Error sincronizando plantilla en BD:`, error.message);
        }
    }
}

// Exportar instancia singleton
export const campaignMessagingService = new CampaignMessagingService();
export default CampaignMessagingService;

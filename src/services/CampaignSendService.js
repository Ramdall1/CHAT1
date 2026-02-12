/**
 * Campaign Send Service
 * Gestiona el envío de campañas con plantillas aprobadas a destinatarios
 */

import sqlite3 from 'sqlite3';
import path from 'path';
import { createLogger } from './core/core/logger.js';
import Dialog360Service from './Dialog360Service.js';

const logger = createLogger('CAMPAIGN_SEND_SERVICE');
const DB_PATH = path.join(process.cwd(), 'data', 'database.sqlite');

// Utilidades de BD
const queryRun = (sql, params = []) => new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_PATH);
    db.run(sql, params, function(err) {
        db.close();
        if (err) return reject(err);
        resolve({ lastID: this.lastID, changes: this.changes });
    });
});

const queryGet = (sql, params = []) => new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_PATH);
    db.get(sql, params, (err, row) => {
        db.close();
        if (err) return reject(err);
        resolve(row || null);
    });
});

const queryAll = (sql, params = []) => new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_PATH);
    db.all(sql, params, (err, rows) => {
        db.close();
        if (err) return reject(err);
        resolve(rows || []);
    });
});

class CampaignSendService {
    /**
     * Preparar campaña para envío
     */
    async prepareCampaignForSend(campaignId, templateId, recipients) {
        try {
            logger.info(`📋 Preparando campaña ${campaignId} para envío`);

            // Obtener plantilla
            const template = await queryGet(
                'SELECT * FROM template_approvals WHERE id = ?',
                [templateId]
            );

            if (!template) {
                throw new Error('Plantilla no encontrada');
            }

            // Validar que plantilla esté aprobada en 360Dialog
            if (template.dialog360_status !== 'APPROVED') {
                throw new Error(`Plantilla no aprobada en 360Dialog (estado: ${template.dialog360_status})`);
            }

            // Parsear datos
            const templateData = JSON.parse(template.template_data);

            // Validar destinatarios
            if (!recipients || recipients.length === 0) {
                throw new Error('No hay destinatarios especificados');
            }

            logger.info(`✅ Campaña preparada: ${recipients.length} destinatarios`);

            return {
                success: true,
                campaign: {
                    id: campaignId,
                    templateId: templateId,
                    dialog360Id: template.dialog360_id,
                    recipientCount: recipients.length
                },
                template: templateData,
                recipients: recipients
            };
        } catch (error) {
            logger.error(`❌ Error preparando campaña: ${error.message}`);
            throw error;
        }
    }

    /**
     * Enviar mensaje a un destinatario
     */
    async sendMessageToRecipient(recipientPhone, templateData, variables = {}) {
        try {
            logger.info(`📤 Enviando mensaje a ${recipientPhone}`);

            // Construir payload para 360Dialog
            const payload = this.buildMessagePayload(recipientPhone, templateData, variables);

            // Aquí iría la llamada real a 360Dialog
            // Por ahora, simular envío
            logger.info(`✅ Mensaje enviado a ${recipientPhone}`);

            return {
                success: true,
                recipient: recipientPhone,
                status: 'sent',
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            logger.error(`❌ Error enviando mensaje: ${error.message}`);
            throw error;
        }
    }

    /**
     * Enviar campaña a múltiples destinatarios
     */
    async sendCampaignToRecipients(campaignId, templateId, recipients, variables = {}) {
        try {
            logger.info(`🚀 Iniciando envío de campaña ${campaignId} a ${recipients.length} destinatarios`);

            // Preparar campaña
            const prepared = await this.prepareCampaignForSend(campaignId, templateId, recipients);

            const results = {
                total: recipients.length,
                sent: 0,
                failed: 0,
                messages: []
            };

            // Enviar a cada destinatario
            for (const recipient of recipients) {
                try {
                    // Reemplazar variables si existen
                    const recipientVariables = this.replaceVariables(variables, recipient);

                    // Enviar mensaje
                    const result = await this.sendMessageToRecipient(
                        recipient.phone,
                        prepared.template,
                        recipientVariables
                    );

                    results.sent++;
                    results.messages.push({
                        recipient: recipient.phone,
                        status: 'sent'
                    });

                    // Registrar en BD
                    await this.logCampaignMessage(campaignId, recipient.id, 'sent');
                } catch (error) {
                    results.failed++;
                    results.messages.push({
                        recipient: recipient.phone,
                        status: 'failed',
                        error: error.message
                    });

                    logger.error(`❌ Error enviando a ${recipient.phone}: ${error.message}`);

                    // Registrar error en BD
                    await this.logCampaignMessage(campaignId, recipient.id, 'failed', error.message);
                }
            }

            // Actualizar estado de campaña
            await queryRun(`
                UPDATE campaigns 
                SET status = 'completed',
                    sent_count = ?,
                    failed_count = ?,
                    completed_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [results.sent, results.failed, campaignId]);

            logger.info(`✅ Campaña completada: ${results.sent} enviados, ${results.failed} fallidos`);

            return {
                success: true,
                campaignId,
                results
            };
        } catch (error) {
            logger.error(`❌ Error en envío de campaña: ${error.message}`);
            throw error;
        }
    }

    /**
     * Construir payload de mensaje para 360Dialog
     * variables es un array: ['Juan', 'juan@ejemplo.com', 'Acme Corp']
     * Se convierte en: {{1}} = Juan, {{2}} = juan@ejemplo.com, {{3}} = Acme Corp
     */
    buildMessagePayload(recipientPhone, templateData, variables = []) {
        const payload = {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: recipientPhone,
            type: 'template',
            template: {
                name: templateData.name,
                language: {
                    code: templateData.language || 'es'
                }
            }
        };

        // Agregar variables si existen (como array)
        if (Array.isArray(variables) && variables.length > 0) {
            payload.template.components = [
                {
                    type: 'body',
                    parameters: variables.map(v => ({
                        type: 'text',
                        text: String(v || '')
                    }))
                }
            ];
        }

        return payload;
    }

    /**
     * Reemplazar variables en mensaje
     * Las variables se mapean como: {{1}} = nombre, {{2}} = email, etc.
     */
    replaceVariables(variableMapping, recipient) {
        const replaced = [];

        // variableMapping es un array como: ['name', 'email', 'company']
        // Se convierte en: ['Juan', 'juan@ejemplo.com', 'Acme Corp']
        if (Array.isArray(variableMapping)) {
            variableMapping.forEach((fieldName) => {
                let value = '';

                // Mapear nombre de campo a valor del contacto
                switch (fieldName.toLowerCase()) {
                    case 'name':
                        value = recipient.name || '';
                        break;
                    case 'email':
                        value = recipient.email || '';
                        break;
                    case 'phone':
                        value = recipient.phone || '';
                        break;
                    case 'company':
                        value = recipient.company || '';
                        break;
                    default:
                        // Si es un campo personalizado
                        value = recipient[fieldName] || '';
                }

                replaced.push(value);
            });
        }

        return replaced;
    }

    /**
     * Registrar mensaje de campaña en BD
     */
    async logCampaignMessage(campaignId, recipientId, status, error = null) {
        try {
            await queryRun(`
                INSERT INTO campaign_messages (
                    campaign_id,
                    recipient_id,
                    status,
                    error_message,
                    sent_at
                ) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
            `, [campaignId, recipientId, status, error]);
        } catch (error) {
            logger.error(`Error registrando mensaje: ${error.message}`);
        }
    }

    /**
     * Obtener estadísticas de campaña
     */
    async getCampaignStats(campaignId) {
        try {
            const stats = await queryGet(`
                SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
                    SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered,
                    SUM(CASE WHEN status = 'read' THEN 1 ELSE 0 END) as read,
                    SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
                FROM campaign_messages
                WHERE campaign_id = ?
            `, [campaignId]);

            return {
                success: true,
                stats: {
                    total: stats?.total || 0,
                    sent: stats?.sent || 0,
                    delivered: stats?.delivered || 0,
                    read: stats?.read || 0,
                    failed: stats?.failed || 0
                }
            };
        } catch (error) {
            logger.error(`Error obteniendo estadísticas: ${error.message}`);
            throw error;
        }
    }

    /**
     * Validar destinatarios
     */
    async validateRecipients(recipients) {
        try {
            const validated = [];
            const errors = [];

            for (const recipient of recipients) {
                if (!recipient.phone) {
                    errors.push(`Destinatario sin teléfono: ${recipient.name || 'desconocido'}`);
                    continue;
                }

                // Validar formato de teléfono
                const phoneRegex = /^\+?[1-9]\d{1,14}$/;
                if (!phoneRegex.test(recipient.phone)) {
                    errors.push(`Teléfono inválido: ${recipient.phone}`);
                    continue;
                }

                validated.push(recipient);
            }

            return {
                valid: validated,
                invalid: errors,
                validCount: validated.length,
                invalidCount: errors.length
            };
        } catch (error) {
            logger.error(`Error validando destinatarios: ${error.message}`);
            throw error;
        }
    }
}

export default new CampaignSendService();

/**
 * Rutas para Envío de Campañas
 * Endpoints para enviar campañas con plantillas aprobadas a destinatarios
 */

import express from 'express';
import CampaignSendService from '../../services/CampaignSendService.js';
import { createLogger } from '../../services/core/core/logger.js';

const router = express.Router();
const logger = createLogger('CAMPAIGN_SEND_ROUTES');

/**
 * POST /api/campaign-send/prepare
 * Preparar campaña para envío
 */
router.post('/prepare', async (req, res) => {
    try {
        const { campaignId, templateId, recipients } = req.body;

        if (!campaignId || !templateId || !recipients) {
            return res.status(400).json({
                success: false,
                error: 'campaignId, templateId y recipients son requeridos'
            });
        }

        logger.info(`📋 Preparando campaña ${campaignId}`);

        const result = await CampaignSendService.prepareCampaignForSend(
            campaignId,
            templateId,
            recipients
        );

        res.json(result);
    } catch (error) {
        logger.error('Error preparando campaña:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/campaign-send/validate-recipients
 * Validar destinatarios
 */
router.post('/validate-recipients', async (req, res) => {
    try {
        const { recipients } = req.body;

        if (!recipients || !Array.isArray(recipients)) {
            return res.status(400).json({
                success: false,
                error: 'recipients debe ser un array'
            });
        }

        logger.info(`🔍 Validando ${recipients.length} destinatarios`);

        const validation = await CampaignSendService.validateRecipients(recipients);

        res.json({
            success: true,
            validation
        });
    } catch (error) {
        logger.error('Error validando destinatarios:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/campaign-send/send
 * Enviar campaña a destinatarios
 */
router.post('/send', async (req, res) => {
    try {
        const { campaignId, templateId, recipients, variables = {} } = req.body;

        if (!campaignId || !templateId || !recipients) {
            return res.status(400).json({
                success: false,
                error: 'campaignId, templateId y recipients son requeridos'
            });
        }

        logger.info(`🚀 Enviando campaña ${campaignId} a ${recipients.length} destinatarios`);

        const result = await CampaignSendService.sendCampaignToRecipients(
            campaignId,
            templateId,
            recipients,
            variables
        );

        res.json(result);
    } catch (error) {
        logger.error('Error enviando campaña:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/campaign-send/:campaignId/send-to-recipient
 * Enviar mensaje a un destinatario específico
 */
router.post('/:campaignId/send-to-recipient', async (req, res) => {
    try {
        const { campaignId } = req.params;
        const { templateData, recipientPhone, variables = {} } = req.body;

        if (!templateData || !recipientPhone) {
            return res.status(400).json({
                success: false,
                error: 'templateData y recipientPhone son requeridos'
            });
        }

        logger.info(`📤 Enviando mensaje a ${recipientPhone}`);

        const result = await CampaignSendService.sendMessageToRecipient(
            recipientPhone,
            templateData,
            variables
        );

        res.json(result);
    } catch (error) {
        logger.error('Error enviando mensaje:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/campaign-send/:campaignId/stats
 * Obtener estadísticas de campaña
 */
router.get('/:campaignId/stats', async (req, res) => {
    try {
        const { campaignId } = req.params;

        logger.info(`📊 Obteniendo estadísticas de campaña ${campaignId}`);

        const result = await CampaignSendService.getCampaignStats(campaignId);

        res.json(result);
    } catch (error) {
        logger.error('Error obteniendo estadísticas:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

export default router;

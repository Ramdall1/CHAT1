/**
 * Rutas para Gestión de Plantillas de Campañas
 * Endpoints para crear, aprobar y enviar plantillas desde campañas
 */

import express from 'express';
import CampaignTemplateService from '../../services/CampaignTemplateService.js';
import { createLogger } from '../../services/core/core/logger.js';

const router = express.Router();
const logger = createLogger('CAMPAIGN_TEMPLATES_ROUTES');

/**
 * POST /api/campaign-templates/create-and-send
 * Crear plantilla desde campaña, aprobarla automáticamente y enviarla a 360Dialog
 */
router.post('/create-and-send', async (req, res) => {
    try {
        const { templateData, requestedBy = 'admin' } = req.body;

        if (!templateData) {
            return res.status(400).json({
                success: false,
                error: 'templateData requerido'
            });
        }

        logger.info(`📝 Creando plantilla de campaña: "${templateData.name}"`);

        // Crear, aprobar y enviar a 360Dialog
        const result = await CampaignTemplateService.createAndApproveTemplate(
            templateData,
            requestedBy
        );

        res.json({
            success: true,
            message: result.message,
            template: {
                id: result.templateId,
                status: result.status,
                dialog360Id: result.dialog360Id,
                dialog360Status: result.dialog360Status
            }
        });
    } catch (error) {
        logger.error('Error creando plantilla:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/campaign-templates/:id
 * Obtener detalles de plantilla de campaña
 */
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const template = await CampaignTemplateService.getTemplate(id);

        res.json({
            success: true,
            template
        });
    } catch (error) {
        logger.error('Error obteniendo plantilla:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/campaign-templates/:id/sync
 * Sincronizar estado de plantilla con 360Dialog
 */
router.post('/:id/sync', async (req, res) => {
    try {
        const { id } = req.params;

        const result = await CampaignTemplateService.syncWithDialog360(id);

        res.json({
            success: result.success,
            message: result.message,
            status: result.status,
            rejectionReason: result.rejectionReason
        });
    } catch (error) {
        logger.error('Error sincronizando:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/campaign-templates/:id/validate
 * Validar que plantilla esté lista para usar en campaña
 */
router.get('/:id/validate', async (req, res) => {
    try {
        const { id } = req.params;

        const validation = await CampaignTemplateService.validateForCampaign(id);

        res.json({
            success: validation.valid,
            valid: validation.valid,
            message: validation.message
        });
    } catch (error) {
        logger.error('Error validando plantilla:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

export default router;

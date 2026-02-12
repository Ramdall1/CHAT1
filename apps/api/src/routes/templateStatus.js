import express from 'express';
import { templateStatusService } from '../services/TemplateStatusService.js';
import { log } from '../core/logger.js';
import { VALID_TEMPLATE_STATUSES } from '../utils/templateValidation.js';

const router = express.Router();

/**
 * @route GET /api/template-status
 * @desc Obtener todos los estados de plantillas
 */
router.get('/', async (req, res) => {
  try {
    const statuses = await templateStatusService.getTemplateStatuses();

    res.json({
      success: true,
      data: statuses,
    });
  } catch (error) {
    log('Error getting template statuses:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * @route GET /api/template-status/stats
 * @desc Obtener estadísticas de plantillas
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await templateStatusService.getTemplateStats();

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    log('Error getting template stats:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * @route GET /api/template-status/:status
 * @desc Obtener plantillas por estado
 */
router.get('/:status', async (req, res) => {
  try {
    const { status } = req.params;
    const templates = await templateStatusService.getTemplatesByStatus(status);

    res.json({
      success: true,
      data: templates,
      count: templates.length,
    });
  } catch (error) {
    log('Error getting templates by status:', error);
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * @route POST /api/template-status/:templateName/submit
 * @desc Enviar plantilla para aprobación
 */
router.post('/:templateName/submit', async (req, res) => {
  try {
    const { templateName } = req.params;
    const { category = 'MARKETING' } = req.body;

    const result = await templateStatusService.submitForApproval(
      templateName,
      category
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    log('Error submitting template for approval:', error);
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * @route POST /api/template-status/:templateName/approve
 * @desc Aprobar una plantilla
 */
router.post('/:templateName/approve', async (req, res) => {
  try {
    const { templateName } = req.params;
    const { note = '' } = req.body;

    const result = await templateStatusService.approveTemplate(
      templateName,
      note
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    log('Error approving template:', error);
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * @route POST /api/template-status/:templateName/reject
 * @desc Rechazar una plantilla
 */
router.post('/:templateName/reject', async (req, res) => {
  try {
    const { templateName } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere una razón para rechazar la plantilla',
      });
    }

    const result = await templateStatusService.rejectTemplate(
      templateName,
      reason
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    log('Error rejecting template:', error);
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * @route PUT /api/template-status/:templateName
 * @desc Actualizar estado de una plantilla
 */
router.put('/:templateName', async (req, res) => {
  try {
    const { templateName } = req.params;
    const { status, reason = '' } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere un estado',
      });
    }

    if (!VALID_TEMPLATE_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        error: `Estado inválido. Estados válidos: ${VALID_TEMPLATE_STATUSES.join(', ')}`,
      });
    }

    const result = await templateStatusService.updateTemplateStatus(
      templateName,
      status,
      reason
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    log('Error updating template status:', error);
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * @route GET /api/template-status/:templateName/check
 * @desc Verificar si una plantilla está aprobada
 */
router.get('/:templateName/check', async (req, res) => {
  try {
    const { templateName } = req.params;
    const isApproved =
      await templateStatusService.isTemplateApproved(templateName);

    res.json({
      success: true,
      data: {
        templateName,
        isApproved,
        status: isApproved ? 'APPROVED' : 'NOT_APPROVED',
      },
    });
  } catch (error) {
    log('Error checking template approval:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;

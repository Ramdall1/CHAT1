/**
 * Endpoints para el Sistema de Aprobación de Plantillas
 */

import express from 'express';
const router = express.Router();

// Middleware para verificar servicios
const checkServices = (req, res, next) => {
  if (!req.app.locals.templateApprovalService) {
    return res.status(503).json({
      error: 'Servicio de aprobación de plantillas no disponible',
    });
  }
  next();
};

// Solicitar aprobación para una plantilla
router.post('/request', checkServices, async (req, res) => {
  try {
    const { templateData, requestedBy } = req.body;

    if (!templateData || !requestedBy) {
      return res.status(400).json({
        error: 'templateData y requestedBy son requeridos',
      });
    }

    const approvalRequest =
      await req.app.locals.templateApprovalService.requestTemplateApproval(
        templateData,
        requestedBy
      );

    res.json({
      success: true,
      approvalRequest,
    });
  } catch (error) {
    console.error('Error solicitando aprobación:', error);
    res.status(500).json({
      error: error.message || 'Error interno del servidor',
    });
  }
});

// Obtener plantillas pendientes de aprobación
router.get('/pending', checkServices, async (req, res) => {
  try {
    const pendingTemplates =
      req.app.locals.templateApprovalService.getPendingTemplates();

    res.json({
      success: true,
      templates: pendingTemplates,
    });
  } catch (error) {
    console.error('Error obteniendo plantillas pendientes:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
    });
  }
});

// Aprobar una plantilla
router.post('/approve/:approvalId', checkServices, async (req, res) => {
  try {
    const { approvalId } = req.params;
    const { approvedBy, notes } = req.body;

    if (!approvedBy) {
      return res.status(400).json({
        error: 'approvedBy es requerido',
      });
    }

    const approvedTemplate =
      await req.app.locals.templateApprovalService.approveTemplate(
        approvalId,
        approvedBy,
        notes
      );

    // Emitir evento via socket
    if (req.app.locals.io) {
      req.app.locals.io.emit('template_approved', {
        approvalId,
        templateName: approvedTemplate.templateData.name,
        approvedBy,
      });
    }

    res.json({
      success: true,
      approvedTemplate,
    });
  } catch (error) {
    console.error('Error aprobando plantilla:', error);
    res.status(500).json({
      error: error.message || 'Error interno del servidor',
    });
  }
});

// Rechazar una plantilla
router.post('/reject/:approvalId', checkServices, async (req, res) => {
  try {
    const { approvalId } = req.params;
    const { rejectedBy, reason } = req.body;

    if (!rejectedBy || !reason) {
      return res.status(400).json({
        error: 'rejectedBy y reason son requeridos',
      });
    }

    const rejectedTemplate =
      await req.app.locals.templateApprovalService.rejectTemplate(
        approvalId,
        rejectedBy,
        reason
      );

    // Emitir evento via socket
    if (req.app.locals.io) {
      req.app.locals.io.emit('template_rejected', {
        approvalId,
        templateName: rejectedTemplate.templateData.name,
        rejectedBy,
        reason,
      });
    }

    res.json({
      success: true,
      rejectedTemplate,
    });
  } catch (error) {
    console.error('Error rechazando plantilla:', error);
    res.status(500).json({
      error: error.message || 'Error interno del servidor',
    });
  }
});

// Obtener plantillas aprobadas
router.get('/approved', checkServices, async (req, res) => {
  try {
    const approvedTemplates =
      req.app.locals.templateApprovalService.getApprovedTemplates();

    res.json({
      success: true,
      templates: approvedTemplates,
    });
  } catch (error) {
    console.error('Error obteniendo plantillas aprobadas:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
    });
  }
});

// Obtener plantillas rechazadas
router.get('/rejected', checkServices, async (req, res) => {
  try {
    const rejectedTemplates =
      req.app.locals.templateApprovalService.getRejectedTemplates();

    res.json({
      success: true,
      templates: rejectedTemplates,
    });
  } catch (error) {
    console.error('Error obteniendo plantillas rechazadas:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
    });
  }
});

// Obtener estadísticas de aprobación
router.get('/stats', checkServices, async (req, res) => {
  try {
    const stats = req.app.locals.templateApprovalService.getApprovalStats();

    res.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
    });
  }
});

// Validar plantilla
router.post('/validate', checkServices, async (req, res) => {
  try {
    const { templateData } = req.body;

    if (!templateData) {
      return res.status(400).json({
        error: 'templateData es requerido',
      });
    }

    const validation =
      await req.app.locals.templateApprovalService.validateTemplate(
        templateData
      );

    res.json({
      success: true,
      validation,
    });
  } catch (error) {
    console.error('Error validando plantilla:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
    });
  }
});

// Verificar si una plantilla está aprobada
router.get('/check/:templateId', checkServices, async (req, res) => {
  try {
    const { templateId } = req.params;

    const isApproved =
      req.app.locals.templateApprovalService.isTemplateApproved(templateId);

    const approvedTemplate = isApproved
      ? req.app.locals.templateApprovalService.getApprovedTemplate(templateId)
      : null;

    res.json({
      success: true,
      isApproved,
      template: approvedTemplate,
    });
  } catch (error) {
    console.error('Error verificando aprobación:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
    });
  }
});

// Limpiar plantillas antiguas
router.post('/cleanup', checkServices, async (req, res) => {
  try {
    const { daysOld = 30 } = req.body;

    const cleaned =
      await req.app.locals.templateApprovalService.cleanupOldTemplates(daysOld);

    res.json({
      success: true,
      cleaned,
    });
  } catch (error) {
    console.error('Error limpiando plantillas:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
    });
  }
});

export default router;

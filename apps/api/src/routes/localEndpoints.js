import express from 'express';
import { clearThrottling } from '../core/utils.js';

const router = express.Router();

// Middleware para verificar que los servicios locales estén disponibles
const checkLocalServices = (req, res, next) => {
  // Solo verificar servicios críticos
  if (!req.app.locals.localContactManager) {
    return res
      .status(503)
      .json({ error: 'Servicio de contactos no disponible' });
  }
  if (!req.app.locals.localMessagingService) {
    return res
      .status(503)
      .json({ error: 'Servicio de mensajería no disponible' });
  }
  next();
};

router.use(checkLocalServices);

// ===== Gestión de Tags =====
router.get('/tags', async (req, res) => {
  try {
    const tags = await req.app.locals.localContactManager.getAllTags();
    // Devolver en el formato esperado por el frontend
    res.json({ tags: tags || [] });
  } catch (error) {
    console.error('Error obteniendo tags:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.post('/tags', async (req, res) => {
  try {
    const { name, description, color } = req.body;
    if (!name)
      return res.status(400).json({ error: 'Nombre del tag requerido' });

    const tag = await req.app.locals.contactManager.createTag({
      name,
      description,
      color,
    });
    res.json(tag);
  } catch (error) {
    console.error('Error creando tag:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.put('/tags/:tagId', async (req, res) => {
  try {
    const { tagId } = req.params;
    const updateData = req.body;

    const tag = await req.app.locals.contactManager.updateTag(
      tagId,
      updateData
    );
    res.json(tag);
  } catch (error) {
    console.error('Error actualizando tag:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.delete('/tags/:tagId', async (req, res) => {
  try {
    const { tagId } = req.params;
    await req.app.locals.contactManager.deleteTag(tagId);
    res.json({ success: true });
  } catch (error) {
    console.error('Error eliminando tag:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ===== Gestión de Campos Personalizados =====
router.get('/custom-fields', async (req, res) => {
  try {
    const fields = await req.app.locals.contactManager.getAllCustomFields();
    res.json(fields);
  } catch (error) {
    console.error('Error obteniendo campos personalizados:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.post('/custom-fields', async (req, res) => {
  try {
    const { name, type, description, options } = req.body;
    if (!name || !type)
      return res.status(400).json({ error: 'Nombre y tipo requeridos' });

    const field = await req.app.locals.contactManager.createCustomField({
      name,
      type,
      description,
      options,
    });
    res.json(field);
  } catch (error) {
    console.error('Error creando campo personalizado:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.put('/custom-fields/:fieldId', async (req, res) => {
  try {
    const { fieldId } = req.params;
    const updateData = req.body;

    const field = await req.app.locals.contactManager.updateCustomField(
      fieldId,
      updateData
    );
    res.json(field);
  } catch (error) {
    console.error('Error actualizando campo personalizado:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.delete('/custom-fields/:fieldId', async (req, res) => {
  try {
    const { fieldId } = req.params;
    await req.app.locals.contactManager.deleteCustomField(fieldId);
    res.json({ success: true });
  } catch (error) {
    console.error('Error eliminando campo personalizado:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ===== Gestión de Contactos Locales =====
router.get('/contacts', async (req, res) => {
  try {
    const { search, tags, segment, limit, offset } = req.query;
    const filters = {
      search,
      tags: tags?.split(','),
      segment,
      limit: parseInt(limit),
      offset: parseInt(offset),
    };

    const contacts =
      await req.app.locals.contactManager.searchContacts(filters);
    res.json(contacts);
  } catch (error) {
    console.error('Error obteniendo contactos:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.post('/contacts', async (req, res) => {
  try {
    const contactData = req.body;
    if (!contactData.phone)
      return res.status(400).json({ error: 'Teléfono requerido' });

    const contact =
      await req.app.locals.contactManager.createContact(contactData);
    res.json(contact);
  } catch (error) {
    console.error('Error creando contacto:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.get('/contacts/:contactId', async (req, res) => {
  try {
    const { contactId } = req.params;
    const contact = await req.app.locals.contactManager.getContact(contactId);

    if (!contact) {
      return res.status(404).json({ error: 'Contacto no encontrado' });
    }

    res.json(contact);
  } catch (error) {
    console.error('Error obteniendo contacto:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.put('/contacts/:contactId', async (req, res) => {
  try {
    const { contactId } = req.params;
    const updateData = req.body;

    const contact = await req.app.locals.contactManager.updateContact(
      contactId,
      updateData
    );
    res.json(contact);
  } catch (error) {
    console.error('Error actualizando contacto:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.delete('/contacts/:contactId', async (req, res) => {
  try {
    const { contactId } = req.params;
    await req.app.locals.contactManager.deleteContact(contactId);
    res.json({ success: true });
  } catch (error) {
    console.error('Error eliminando contacto:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.post('/contacts/:contactId/tags', async (req, res) => {
  try {
    const { contactId } = req.params;
    const { tagId } = req.body;

    await req.app.locals.contactManager.addTagToContact(contactId, tagId);
    res.json({ success: true });
  } catch (error) {
    console.error('Error agregando tag a contacto:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.delete('/contacts/:contactId/tags/:tagId', async (req, res) => {
  try {
    const { contactId, tagId } = req.params;

    await req.app.locals.contactManager.removeTagFromContact(contactId, tagId);
    res.json({ success: true });
  } catch (error) {
    console.error('Error removiendo tag de contacto:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.post('/contacts/:contactId/fields', async (req, res) => {
  try {
    const { contactId } = req.params;
    const { fieldId, value } = req.body;

    await req.app.locals.contactManager.setCustomFieldValue(
      contactId,
      fieldId,
      value
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Error estableciendo valor de campo:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.post('/contacts/import', async (req, res) => {
  try {
    const { contacts, options } = req.body;
    if (!Array.isArray(contacts))
      return res.status(400).json({ error: 'Array de contactos requerido' });

    const result = await req.app.locals.contactManager.importContacts(
      contacts,
      options
    );
    res.json(result);
  } catch (error) {
    console.error('Error importando contactos:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.get('/contacts/export', async (req, res) => {
  try {
    const { format, filters } = req.query;
    const result = await req.app.locals.contactManager.exportContacts(
      format,
      filters
    );
    res.json(result);
  } catch (error) {
    console.error('Error exportando contactos:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ===== Gestión de Segmentos de Audiencia =====
router.get('/segments', async (req, res) => {
  try {
    const segments = await req.app.locals.audienceSegmentation.getAllSegments();
    res.json(segments);
  } catch (error) {
    console.error('Error obteniendo segmentos:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.post('/segments', async (req, res) => {
  try {
    const segmentData = req.body;
    if (!segmentData.name)
      return res.status(400).json({ error: 'Nombre del segmento requerido' });

    const segment =
      await req.app.locals.audienceSegmentation.createSegment(segmentData);
    res.json(segment);
  } catch (error) {
    console.error('Error creando segmento:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.get('/segments/:segmentId', async (req, res) => {
  try {
    const { segmentId } = req.params;
    const segment =
      await req.app.locals.audienceSegmentation.getSegment(segmentId);

    if (!segment) {
      return res.status(404).json({ error: 'Segmento no encontrado' });
    }

    res.json(segment);
  } catch (error) {
    console.error('Error obteniendo segmento:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.put('/segments/:segmentId', async (req, res) => {
  try {
    const { segmentId } = req.params;
    const updateData = req.body;

    const segment = await req.app.locals.audienceSegmentation.updateSegment(
      segmentId,
      updateData
    );
    res.json(segment);
  } catch (error) {
    console.error('Error actualizando segmento:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.delete('/segments/:segmentId', async (req, res) => {
  try {
    const { segmentId } = req.params;
    await req.app.locals.audienceSegmentation.deleteSegment(segmentId);
    res.json({ success: true });
  } catch (error) {
    console.error('Error eliminando segmento:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.get('/segments/:segmentId/contacts', async (req, res) => {
  try {
    const { segmentId } = req.params;
    const contacts =
      await req.app.locals.audienceSegmentation.getSegmentContacts(segmentId);
    res.json(contacts);
  } catch (error) {
    console.error('Error obteniendo contactos del segmento:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.post('/segments/:segmentId/contacts', async (req, res) => {
  try {
    const { segmentId } = req.params;
    const { contactId } = req.body;

    await req.app.locals.audienceSegmentation.addContactToSegment(
      segmentId,
      contactId
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Error agregando contacto al segmento:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.delete('/segments/:segmentId/contacts/:contactId', async (req, res) => {
  try {
    const { segmentId, contactId } = req.params;

    await req.app.locals.audienceSegmentation.removeContactFromSegment(
      segmentId,
      contactId
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Error removiendo contacto del segmento:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ===== Gestión de Flujos de Automatización =====
router.get('/automation-flows', async (req, res) => {
  try {
    const flows = await req.app.locals.automationManager.getAllFlows();
    res.json(flows);
  } catch (error) {
    console.error('Error obteniendo flujos:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.post('/automation-flows', async (req, res) => {
  try {
    const flowData = req.body;
    if (!flowData.name)
      return res.status(400).json({ error: 'Nombre del flujo requerido' });

    const flow = await req.app.locals.automationManager.createFlow(flowData);
    res.json(flow);
  } catch (error) {
    console.error('Error creando flujo:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.get('/automation-flows/:flowId', async (req, res) => {
  try {
    const { flowId } = req.params;
    const flow = await req.app.locals.automationManager.getFlow(flowId);

    if (!flow) {
      return res.status(404).json({ error: 'Flujo no encontrado' });
    }

    res.json(flow);
  } catch (error) {
    console.error('Error obteniendo flujo:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.put('/automation-flows/:flowId', async (req, res) => {
  try {
    const { flowId } = req.params;
    const updateData = req.body;

    const flow = await req.app.locals.automationManager.updateFlow(
      flowId,
      updateData
    );
    res.json(flow);
  } catch (error) {
    console.error('Error actualizando flujo:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.delete('/automation-flows/:flowId', async (req, res) => {
  try {
    const { flowId } = req.params;
    await req.app.locals.automationManager.deleteFlow(flowId);
    res.json({ success: true });
  } catch (error) {
    console.error('Error eliminando flujo:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.post('/automation-flows/:flowId/execute', async (req, res) => {
  try {
    const { flowId } = req.params;
    const { contactId, variables } = req.body;

    const result = await req.app.locals.automationManager.executeFlow(
      flowId,
      contactId,
      variables
    );
    res.json(result);
  } catch (error) {
    console.error('Error ejecutando flujo:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.get('/automation-flows/:flowId/executions', async (req, res) => {
  try {
    const { flowId } = req.params;
    const { limit, offset } = req.query;

    const executions = await req.app.locals.automationManager.getFlowExecutions(
      flowId,
      { limit, offset }
    );
    res.json(executions);
  } catch (error) {
    console.error('Error obteniendo ejecuciones del flujo:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ===== Gestión de Mensajería Local =====
router.post('/messages/send-text', async (req, res) => {
  try {
    const { to, text, variables } = req.body;
    if (!to || !text)
      return res.status(400).json({ error: 'Destinatario y texto requeridos' });

    const result = await req.app.locals.localMessagingService.sendTextMessage(
      to,
      text,
      variables
    );
    res.json(result);
  } catch (error) {
    console.error('Error enviando mensaje de texto:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.post('/messages/send-template', async (req, res) => {
  try {
    const { to, templateId, variables } = req.body;
    if (!to || !templateId)
      return res
        .status(400)
        .json({ error: 'Destinatario y template requeridos' });

    const result =
      await req.app.locals.localMessagingService.sendTemplateMessage(
        to,
        templateId,
        variables
      );
    res.json(result);
  } catch (error) {
    console.error('Error enviando template:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.post('/messages/send-media', async (req, res) => {
  try {
    const { to, mediaType, mediaUrl, caption } = req.body;
    if (!to || !mediaType || !mediaUrl)
      return res
        .status(400)
        .json({ error: 'Destinatario, tipo y URL de media requeridos' });

    const result = await req.app.locals.localMessagingService.sendMediaMessage(
      to,
      mediaType,
      mediaUrl,
      caption
    );
    res.json(result);
  } catch (error) {
    console.error('Error enviando media:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.get('/messages', async (req, res) => {
  try {
    const { phone, limit, offset, type } = req.query;
    const filters = {
      phone,
      limit: parseInt(limit),
      offset: parseInt(offset),
      type,
    };

    const messages =
      await req.app.locals.localMessagingService.getMessages(filters);
    res.json(messages);
  } catch (error) {
    console.error('Error obteniendo mensajes:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.get('/messages/analytics', async (req, res) => {
  try {
    const { startDate, endDate, groupBy } = req.query;
    const analytics = await req.app.locals.localMessagingService.getAnalytics({
      startDate,
      endDate,
      groupBy,
    });
    res.json(analytics);
  } catch (error) {
    console.error('Error obteniendo analytics:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ===== Gestión de Templates =====
router.get('/templates', async (req, res) => {
  try {
    const templates =
      await req.app.locals.localMessagingService.getAllTemplates();
    // Devolver en el formato esperado por el frontend
    res.json({ templates: templates || [] });
  } catch (error) {
    console.error('Error obteniendo templates:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.post('/templates', async (req, res) => {
  try {
    const templateData = req.body;
    if (!templateData.name || !templateData.content) {
      return res
        .status(400)
        .json({ error: 'Nombre y contenido del template requeridos' });
    }

    const template =
      await req.app.locals.localMessagingService.createTemplate(templateData);
    res.json(template);
  } catch (error) {
    console.error('Error creando template:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.get('/templates/:templateId', async (req, res) => {
  try {
    const { templateId } = req.params;
    const template =
      await req.app.locals.localMessagingService.getTemplate(templateId);

    if (!template) {
      return res.status(404).json({ error: 'Template no encontrado' });
    }

    res.json(template);
  } catch (error) {
    console.error('Error obteniendo template:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.put('/templates/:templateId', async (req, res) => {
  try {
    const { templateId } = req.params;
    const updateData = req.body;

    const template = await req.app.locals.localMessagingService.updateTemplate(
      templateId,
      updateData
    );
    res.json(template);
  } catch (error) {
    console.error('Error actualizando template:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.delete('/templates/:templateId', async (req, res) => {
  try {
    const { templateId } = req.params;
    await req.app.locals.localMessagingService.deleteTemplate(templateId);
    res.json({ success: true });
  } catch (error) {
    console.error('Error eliminando template:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ===== Gestión de Campañas Masivas =====
router.post('/campaigns/bulk', async (req, res) => {
  try {
    const campaignData = req.body;
    if (!campaignData.name || !campaignData.message) {
      return res
        .status(400)
        .json({ error: 'Nombre de campaña y mensaje requeridos' });
    }

    const campaign =
      await req.app.locals.localMessagingService.createBulkCampaign(
        campaignData
      );
    res.json(campaign);
  } catch (error) {
    console.error('Error creando campaña masiva:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.get('/campaigns', async (req, res) => {
  try {
    const { status, limit, offset } = req.query;
    const filters = {
      status,
      limit: parseInt(limit),
      offset: parseInt(offset),
    };

    const campaigns =
      await req.app.locals.localMessagingService.getCampaigns(filters);
    res.json(campaigns);
  } catch (error) {
    console.error('Error obteniendo campañas:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.get('/campaigns/:campaignId', async (req, res) => {
  try {
    const { campaignId } = req.params;
    const campaign =
      await req.app.locals.localMessagingService.getCampaign(campaignId);

    if (!campaign) {
      return res.status(404).json({ error: 'Campaña no encontrada' });
    }

    res.json(campaign);
  } catch (error) {
    console.error('Error obteniendo campaña:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.post('/campaigns/:campaignId/start', async (req, res) => {
  try {
    const { campaignId } = req.params;
    const result =
      await req.app.locals.localMessagingService.startCampaign(campaignId);
    res.json(result);
  } catch (error) {
    console.error('Error iniciando campaña:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.post('/campaigns/:campaignId/pause', async (req, res) => {
  try {
    const { campaignId } = req.params;
    const result =
      await req.app.locals.localMessagingService.pauseCampaign(campaignId);
    res.json(result);
  } catch (error) {
    console.error('Error pausando campaña:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.post('/campaigns/:campaignId/stop', async (req, res) => {
  try {
    const { campaignId } = req.params;
    const result =
      await req.app.locals.localMessagingService.stopCampaign(campaignId);
    res.json(result);
  } catch (error) {
    console.error('Error deteniendo campaña:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.get('/campaigns/:campaignId/stats', async (req, res) => {
  try {
    const { campaignId } = req.params;
    const stats =
      await req.app.locals.localMessagingService.getCampaignStats(campaignId);
    res.json(stats);
  } catch (error) {
    console.error('Error obteniendo estadísticas de campaña:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ===== Mensajes Programados =====
router.post('/messages/schedule', async (req, res) => {
  try {
    const { to, message, scheduledAt, type, templateId, variables } = req.body;
    if (!to || !scheduledAt || (!message && !templateId)) {
      return res
        .status(400)
        .json({
          error: 'Destinatario, fecha programada y mensaje/template requeridos',
        });
    }

    const result = await req.app.locals.localMessagingService.scheduleMessage({
      to,
      message,
      scheduledAt,
      type,
      templateId,
      variables,
    });
    res.json(result);
  } catch (error) {
    console.error('Error programando mensaje:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.get('/messages/scheduled', async (req, res) => {
  try {
    const { status, limit, offset } = req.query;
    const filters = {
      status,
      limit: parseInt(limit),
      offset: parseInt(offset),
    };

    const scheduledMessages =
      await req.app.locals.localMessagingService.getScheduledMessages(filters);
    res.json(scheduledMessages);
  } catch (error) {
    console.error('Error obteniendo mensajes programados:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.delete('/messages/scheduled/:messageId', async (req, res) => {
  try {
    const { messageId } = req.params;
    await req.app.locals.localMessagingService.cancelScheduledMessage(
      messageId
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Error cancelando mensaje programado:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ===== Utilidades de Debug =====
router.post('/clear-throttling', async (req, res) => {
  try {
    const { phone } = req.body;
    clearThrottling(phone);
    res.json({
      success: true,
      message: phone
        ? `Throttling limpiado para ${phone}`
        : 'Throttling limpiado para todos los números',
    });
  } catch (error) {
    console.error('Error limpiando throttling:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

export default router;

/**
 * Sistema de Webhooks para 360dialog
 * Manejo completo de respuestas, estados de entrega y eventos
 */

import express from 'express';
import axios from 'axios';
import path from 'path';
import fs from 'fs';
import {
  detectPurchaseIntention,
  processAIResponse,
  throttled,
  detectNameFromMessage,
} from '../../../apps/api/src/core/utils.js';
import { unifiedWebhookService } from '../../services/core/core/UnifiedWebhookService.js';
import { chatLogic } from '../../../apps/api/src/ai/chatLogic.js';
import { createLogger } from '../../services/core/core/logger.js';
import analyticsService from '../../../apps/api/src/services/AnalyticsService.js';
import { enhancedWebhookService } from '../../../apps/api/src/services/EnhancedWebhookService.js';
import { intelligentAI } from '../../../apps/api/src/services/IntelligentAIService.js';
import cacheService from '../../services/core/core/CacheService.js';
import { interactiveMessageHandler } from '../../services/InteractiveMessageHandler.js';

const logger = createLogger('WEBHOOKS');
const router = express.Router();

// Webhook validation removed - no longer needed

// Función principal para procesar webhooks
const processWebhook = async (req, res) => {
  const startTime = Date.now();

  try {
    logger.info('🔔 Webhook recibido en /api/webhook/360dialog');
    logger.info('📦 ===== PAYLOAD COMPLETO RECIBIDO =====');
    logger.info(JSON.stringify(req.body, null, 2));
    logger.info('📦 ======================================');
    
    // Log específico para mensajes de imagen
    const messages = req.body?.entry?.[0]?.changes?.[0]?.value?.messages;
    if (messages && messages.length > 0) {
      messages.forEach((msg, index) => {
        logger.debug(`📨 Mensaje ${index + 1}: Tipo=${msg.type}, From=${msg.from}`);
        if (msg.type === 'image') {
          logger.debug(`Image ID: ${msg.image?.id}`, { image: msg.image });
        }
      });
    }
    
    // Configurar servicios en UnifiedWebhookService si están disponibles
    logger.debug('🔧 Configurando servicios en UnifiedWebhookService', {
      hasLocalMessagingService: !!req.app.locals.localMessagingService,
      hasLocalContactManager: !!req.app.locals.localContactManager,
      hasSocketIO: !!req.app.locals.io,
      unifiedWebhookServiceConfigured: {
        hasLocalMessagingService: !!unifiedWebhookService.localMessagingService,
        hasContactManager: !!unifiedWebhookService.contactManager,
        hasSocketIO: !!unifiedWebhookService.io
      }
    });

    if (req.app.locals.localMessagingService && !unifiedWebhookService.localMessagingService) {
      unifiedWebhookService.setLocalMessagingService(req.app.locals.localMessagingService);
      logger.info('✅ LocalMessagingService configurado en UnifiedWebhookService');
    }

    if (req.app.locals.localContactManager && !unifiedWebhookService.contactManager) {
      unifiedWebhookService.setContactManager(req.app.locals.localContactManager);
      logger.info('✅ ContactManager configurado en UnifiedWebhookService');
    }

    if (req.app.locals.io && !unifiedWebhookService.io) {
      unifiedWebhookService.setSocketIO(req.app.locals.io);
      logger.info('✅ Socket.IO configurado en UnifiedWebhookService');
    } else if (!req.app.locals.io) {
      logger.warn('⚠️ Socket.IO no disponible en req.app.locals');
    } else if (unifiedWebhookService.io) {
      logger.debug('ℹ️ Socket.IO ya configurado en UnifiedWebhookService');
    }

    // Configurar BD para deduplicación persistente
    if (req.app.locals.db && !unifiedWebhookService.db) {
      unifiedWebhookService.setDatabase(req.app.locals.db);
      logger.info('✅ Database configurada en UnifiedWebhookService para deduplicación persistente');
    }
    
    // Usar el servicio unificado de webhooks
    const signature = req.headers['x-360dialog-signature'];
    const result = await unifiedWebhookService.processWebhook(
      req.body,
      signature
    );

    // Responder inmediatamente con el resultado
    if (result.success) {
      res.status(200).json({
        success: true,
        webhookId: result.webhookId,
        processingTime: result.processingTime,
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error,
        webhookId: result.webhookId,
      });
    }

    // Track webhook performance
    const processingTime = Date.now() - startTime;
    analyticsService.trackPerformance(processingTime, 'webhook');

    return;

  } catch (error) {
    logger.error('Error en processWebhook:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }
};

// Rutas de webhook - sin validación
router.post('/', processWebhook); // Ruta principal para /webhooks
router.post('/360dialog', processWebhook); // Ruta específica para /webhooks/360dialog

// Función de verificación de webhook
const verifyWebhook = (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const verifyToken = process.env.WEBHOOK_VERIFY_TOKEN;


  if (mode === 'subscribe' && token === verifyToken) {
    logger.info('Webhook verificado correctamente');
    res.status(200).send(challenge);
  } else {
    logger.error('Error verificando webhook - tokens no coinciden');
    res.status(403).json({ error: 'Forbidden' });
  }
};

// Verificación de webhook (GET request)
router.get('/', verifyWebhook); // Ruta principal para /webhooks
router.get('/360dialog', verifyWebhook); // Ruta específica para /webhooks/360dialog

// REMOVED: processIncomingMessage function - now handled by UnifiedWebhookService
// The UnifiedWebhookService now handles both media download and Socket.IO emission

// Procesar estados de entrega
async function processMessageStatus(status, appLocals) {
  try {
    const {
      id: messageId,
      status: deliveryStatus,
      timestamp,
      recipient_id,
      conversation,
      pricing,
    } = status;

    logger.debug(`📊 Estado de mensaje ${messageId}: ${deliveryStatus}`);

    // Validar que tenemos los datos necesarios
    if (!messageId || !deliveryStatus) {
      logger.warn(`⚠️ Datos incompletos para actualizar estado: messageId=${messageId}, status=${deliveryStatus}`);
      return;
    }

    // Actualizar estado en base de datos
    if (
      appLocals.localMessagingService &&
      typeof appLocals.localMessagingService.updateMessageStatus === 'function'
    ) {
      try {
        await appLocals.localMessagingService.updateMessageStatus(messageId, {
          status: deliveryStatus,
          timestamp: timestamp
            ? new Date(parseInt(timestamp) * 1000)
            : new Date(),
          conversation,
          pricing,
        });
      } catch (updateError) {
        logger.error(
          'Error actualizando estado en LocalMessagingService:',
          updateError
        );
      }
    } else {
      logger.warn(
        'LocalMessagingService no disponible o método updateMessageStatus no encontrado'
      );
    }

    // Emitir evento via socket
    if (appLocals.io) {
      try {
        appLocals.io.emit('message_status_update', {
          messageId,
          status: deliveryStatus,
          timestamp,
          recipient: recipient_id,
        });
      } catch (socketError) {
        logger.error('Error emitiendo evento de socket:', socketError);
      }
    }

    // Notificar si hay error de entrega
    if (deliveryStatus === 'failed') {
      if (appLocals.io) {
        appLocals.io.emit('system_notice', {
          type: 'error',
          message: `Error entregando mensaje a ${recipient_id}`,
          messageId,
        });
      }
    }
  } catch (error) {
    logger.error('Error procesando estado de mensaje:', error);
  }
}

// Procesar respuestas de plantillas
async function processTemplateResponse(templateResponse, appLocals) {
  try {
    const {
      template_id,
      template_name,
      response_type,
      response_data,
      from,
      timestamp,
      message_id,
    } = templateResponse;

    logger.info(`📋 Respuesta de plantilla ${template_name} de ${from}: ${response_type}`);

    // Guardar respuesta de plantilla
    if (appLocals.localMessagingService) {
      await appLocals.localMessagingService.saveTemplateResponse({
        templateId: template_id,
        templateName: template_name,
        responseType: response_type,
        responseData: response_data,
        from,
        timestamp: new Date(parseInt(timestamp) * 1000),
        messageId: message_id,
      });
    }

    // Emitir evento via socket
    if (appLocals.io) {
      appLocals.io.emit('template_response', {
        templateId: template_id,
        templateName: template_name,
        responseType: response_type,
        responseData: response_data,
        from,
        timestamp,
      });
    }

    // Procesar según tipo de respuesta
    switch (response_type) {
      case 'button_click':
        await handleTemplateButtonClick(templateResponse, appLocals);
        break;
      case 'quick_reply':
        await handleTemplateQuickReply(templateResponse, appLocals);
        break;
      case 'url_click':
        await handleTemplateUrlClick(templateResponse, appLocals);
        break;
      default:
        logger.warn(
          'Tipo de respuesta de plantilla no manejado:',
          response_type
        );
    }
  } catch (error) {
    logger.error('Error procesando respuesta de plantilla:', error);
  }
}

// Procesar respuestas de flows
async function processFlowResponse(flowResponse, appLocals) {
  try {
    const {
      flow_id,
      flow_name,
      response_data,
      from,
      timestamp,
      message_id,
      flow_token,
    } = flowResponse;

    logger.info(`📋 Respuesta de flow ${flow_name} de ${from}`);

    // Guardar respuesta de flow (mantener funcionalidad existente)
    if (appLocals.localMessagingService) {
      await appLocals.localMessagingService.saveFlowResponse({
        flowId: flow_id,
        flowName: flow_name,
        responseData: response_data,
        from,
        timestamp: new Date(parseInt(timestamp) * 1000),
        messageId: message_id,
        flowToken: flow_token,
      });
    }

    // Emitir evento via socket (mantener funcionalidad existente)
    if (appLocals.io) {
      appLocals.io.emit('flow_response', {
        flowId: flow_id,
        flowName: flow_name,
        responseData: response_data,
        from,
        timestamp,
        flowToken: flow_token,
      });
    }

    // Usar el servicio mejorado para procesar respuesta de flow con IA
    try {
      await enhancedWebhookService.procesarRespuestaFlow(
        flowResponse,
        appLocals
      );
      logger.info(`✅ Respuesta de flow procesada con servicio mejorado para ${from}`);
    } catch (enhancedError) {
      logger.error('❌ Error en servicio mejorado, usando método tradicional:', enhancedError);
      // Fallback al método tradicional
      await handleFlowData(flowResponse, appLocals);
    }
  } catch (error) {
    logger.error('Error procesando respuesta de flow:', error);
  }
}

// Extraer contenido del mensaje según su tipo
function extractMessageContent(message) {
  const { type } = message;

  switch (type) {
    case 'text':
      return message.text?.body || '';
    case 'image':
      return message.image?.caption || '[Imagen]';
    case 'audio':
      return '[Audio]';
    case 'video':
      return message.video?.caption || '[Video]';
    case 'document':
      return message.document?.filename || '[Documento]';
    case 'location':
      return `[Ubicación: ${message.location?.latitude}, ${message.location?.longitude}]`;
    case 'contacts':
      return `[Contacto: ${message.contacts?.[0]?.name?.formatted_name || 'Sin nombre'}]`;
    case 'interactive':
      if (message.interactive?.type === 'button_reply') {
        return `[Botón: ${message.interactive.button_reply.title}]`;
      } else if (message.interactive?.type === 'list_reply') {
        return `[Lista: ${message.interactive.list_reply.title}]`;
      } else if (message.interactive?.type === 'nfm_reply') {
        // Manejo específico para respuestas de Flows
        const flowName = message.interactive.nfm_reply?.name || 'Flow';
        const responseData = message.interactive.nfm_reply?.response_json || {};
        return `[Flow: ${flowName} - Token: ${responseData.flow_token || 'N/A'}]`;
      }
      return '[Interactivo]';
    case 'button':
      return `[Botón: ${message.button?.text}]`;
    case 'list_reply':
      return `[Lista: ${message.list_reply?.title}]`;
    default:
      return `[${type}]`;
  }
}

// Extraer URL del media según el tipo
function extractMediaUrl(message) {
  const { type } = message;
  
  switch (type) {
    case 'image':
      return message.image?.id || message.image?.link || null;
    case 'audio':
      return message.audio?.id || message.audio?.link || null;
    case 'video':
      return message.video?.id || message.video?.link || null;
    case 'document':
      return message.document?.id || message.document?.link || null;
    case 'sticker':
      return message.sticker?.id || message.sticker?.link || null;
    default:
      return null;
  }
}

// Extraer tipo MIME del media
function extractMediaType(message) {
  const { type } = message;
  
  switch (type) {
    case 'image':
      return message.image?.mime_type || 'image/jpeg';
    case 'audio':
      return message.audio?.mime_type || 'audio/ogg';
    case 'video':
      return message.video?.mime_type || 'video/mp4';
    case 'document':
      return message.document?.mime_type || 'application/pdf';
    case 'sticker':
      return 'image/webp';
    default:
      return null;
  }
}

// Manejar click en botón de plantilla
async function handleTemplateButtonClick(templateResponse, appLocals) {
  const { response_data, from } = templateResponse;

  // Implementar lógica específica para clicks en botones
  logger.info(`Botón clickeado por ${from}`, { data: response_data });

  // Ejemplo: enviar mensaje de seguimiento
  if (appLocals.localAutomationManager) {
    await appLocals.localAutomationManager.handleTemplateButtonClick(
      templateResponse
    );
  }
}

// Manejar respuesta rápida de plantilla
async function handleTemplateQuickReply(templateResponse, appLocals) {
  const { response_data, from } = templateResponse;

  logger.info(`Respuesta rápida de ${from}`, { data: response_data });

  if (appLocals.localAutomationManager) {
    await appLocals.localAutomationManager.handleTemplateQuickReply(
      templateResponse
    );
  }
}

// Manejar click en URL de plantilla
async function handleTemplateUrlClick(templateResponse, appLocals) {
  const { response_data, from } = templateResponse;

  logger.info(`URL clickeada por ${from}`, { data: response_data });

  // Registrar analytics de clicks
  if (appLocals.localMessagingService) {
    await appLocals.localMessagingService.recordUrlClick({
      from,
      url: response_data.url,
      timestamp: new Date(),
    });
  }
}

// Manejar datos de flow
async function handleFlowData(flowResponse, appLocals) {
  const { response_data, from, flow_id } = flowResponse;

  logger.info(`Datos de flow recibidos de ${from}`, { data: response_data });

  // Procesar datos del formulario del flow
  if (response_data && typeof response_data === 'object') {
    // Actualizar contacto con datos del flow
    if (appLocals.localContactManager) {
      await appLocals.localContactManager.updateContactFromFlow(
        from,
        response_data
      );
    }

    // Ejecutar automatizaciones basadas en datos del flow
    if (appLocals.localAutomationManager) {
      await appLocals.localAutomationManager.handleFlowData(flowResponse);
    }
  }
}

// NOTA: handleFlowResponse fue reemplazado por InteractiveMessageHandler
// Ver: src/services/InteractiveMessageHandler.js

// Endpoint para obtener estadísticas de webhooks
router.get('/stats', async (req, res) => {
  try {
    const stats = {
      messagesReceived: await getWebhookStats('messages_received'),
      templatesResponses: await getWebhookStats('template_responses'),
      flowResponses: await getWebhookStats('flow_responses'),
      deliveryStatuses: await getWebhookStats('delivery_statuses'),
    };

    res.json(stats);
  } catch (error) {
    logger.error('Error obteniendo estadísticas de webhooks:', error);
    res.status(500).json({ error: 'Error obteniendo estadísticas' });
  }
});

// Función auxiliar para obtener estadísticas
async function getWebhookStats(type) {
  // Implementar según base de datos utilizada
  return 0;
}

export default router;

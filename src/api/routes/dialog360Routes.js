/**
 * 360Dialog API Routes
 * Rutas para interactuar con la API de 360Dialog
 */

import express from 'express';
import { createLogger } from '../../services/core/core/logger.js';

const router = express.Router();
const logger = createLogger('360DIALOG_ROUTES');

const DIALOG360_API_KEY = process.env.DIALOG360_API_KEY;
const DIALOG360_PARTNER_API_KEY = process.env.DIALOG360_PARTNER_API_KEY || process.env.DIALOG360_API_KEY;
const WABA_API_BASE = process.env.WABA_API_BASE || 'https://waba-v2.360dialog.io';
const HUB_API_BASE = 'https://hub.360dialog.io';
const PARTNER_ID = process.env.DIALOG360_PARTNER_ID;
const WABA_ACCOUNT_ID = process.env.DIALOG360_WABA_ACCOUNT_ID;

/**
 * GET /api/360dialog/templates
 * Obtener todas las plantillas aprobadas
 */
router.get('/templates', async (req, res) => {
    try {
        if (!DIALOG360_API_KEY) {
            return res.status(500).json({
                success: false,
                error: 'API Key de 360Dialog no configurada'
            });
        }

        logger.info('Obteniendo plantillas de 360Dialog...');

        const response = await fetch(`${WABA_API_BASE}/v1/configs/templates`, {
            method: 'GET',
            headers: {
                'D360-API-KEY': DIALOG360_API_KEY,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            logger.error('Error de 360Dialog API:', errorText);
            return res.status(response.status).json({
                success: false,
                error: 'Error al obtener plantillas de 360Dialog',
                details: errorText
            });
        }

        const data = await response.json();
        
        // Obtener todas las plantillas
        const templates = data.waba_templates || [];
        
        // Filtrar solo plantillas aprobadas (status puede ser 'APPROVED' o 'approved')
        const approvedTemplates = templates.filter(t => 
            t.status && t.status.toUpperCase() === 'APPROVED'
        );

        logger.info(`Plantillas totales: ${templates.length}, Aprobadas: ${approvedTemplates.length}`);
        logger.info(`Detalles de plantillas: ${JSON.stringify(templates.map(t => ({ name: t.name, status: t.status })))}`);

        res.json({
            success: true,
            templates: approvedTemplates.length > 0 ? approvedTemplates : templates,
            total: approvedTemplates.length > 0 ? approvedTemplates.length : templates.length,
            allTemplates: templates,
            totalAll: templates.length,
            approvedCount: approvedTemplates.length
        });

    } catch (error) {
        logger.error('Error obteniendo plantillas:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno al obtener plantillas',
            message: error.message
        });
    }
});

/**
 * GET /api/360dialog/flows
 * Obtener todos los flows publicados
 */
router.get('/flows', async (req, res) => {
    try {
        if (!DIALOG360_API_KEY || !PARTNER_ID || !WABA_ACCOUNT_ID) {
            return res.status(500).json({
                success: false,
                error: 'Credenciales de 360Dialog no configuradas completamente',
                missing: {
                    apiKey: !DIALOG360_API_KEY,
                    partnerId: !PARTNER_ID,
                    wabaAccountId: !WABA_ACCOUNT_ID
                }
            });
        }

        logger.info('Obteniendo flows de 360Dialog...');

        const url = `${HUB_API_BASE}/api/v2/partners/${PARTNER_ID}/waba_accounts/${WABA_ACCOUNT_ID}/flows`;

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'X-API-KEY': DIALOG360_API_KEY,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            logger.error('Error de 360Dialog Hub API:', errorText);
            return res.status(response.status).json({
                success: false,
                error: 'Error al obtener flows de 360Dialog',
                details: errorText
            });
        }

        const data = await response.json();
        
        // Los flows vienen en data.flows o directamente en data
        const flows = data.flows || data || [];
        const publishedFlows = flows.filter(f => f.status === 'PUBLISHED');

        logger.info(`Flows obtenidos: ${flows.length}, Publicados: ${publishedFlows.length}`);

        res.json({
            success: true,
            flows: publishedFlows,
            total: publishedFlows.length
        });

    } catch (error) {
        logger.error('Error obteniendo flows:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno al obtener flows',
            message: error.message
        });
    }
});

/**
 * GET /api/360dialog/flows/:flowId
 * Obtener detalles de un flow específico
 */
router.get('/flows/:flowId', async (req, res) => {
    try {
        const { flowId } = req.params;

        if (!DIALOG360_API_KEY || !PARTNER_ID || !WABA_ACCOUNT_ID) {
            return res.status(500).json({
                success: false,
                error: 'Credenciales de 360Dialog no configuradas'
            });
        }

        logger.info(`Obteniendo detalles del flow ${flowId}...`);

        const url = `${HUB_API_BASE}/api/v2/partners/${PARTNER_ID}/waba_accounts/${WABA_ACCOUNT_ID}/flows/${flowId}`;

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'X-API-KEY': DIALOG360_API_KEY,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            logger.error('Error obteniendo flow:', errorText);
            return res.status(response.status).json({
                success: false,
                error: 'Error al obtener detalles del flow',
                details: errorText
            });
        }

        const flowData = await response.json();

        logger.info(`Detalles del flow ${flowId} obtenidos`);

        res.json({
            success: true,
            flow: flowData
        });

    } catch (error) {
        logger.error('Error obteniendo detalles del flow:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno al obtener flow',
            message: error.message
        });
    }
});

/**
 * GET /api/360dialog/templates/:templateName
 * Obtener detalles de una plantilla específica
 */
router.get('/templates/:templateName', async (req, res) => {
    try {
        const { templateName } = req.params;

        if (!DIALOG360_API_KEY) {
            return res.status(500).json({
                success: false,
                error: 'API Key de 360Dialog no configurada'
            });
        }

        logger.info(`Obteniendo detalles de la plantilla ${templateName}...`);

        const response = await fetch(`${WABA_API_BASE}/v1/configs/templates`, {
            method: 'GET',
            headers: {
                'D360-API-KEY': DIALOG360_API_KEY,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            return res.status(response.status).json({
                success: false,
                error: 'Error al obtener plantillas'
            });
        }

        const data = await response.json();
        const templates = data.waba_templates || [];
        const template = templates.find(t => t.name === templateName);

        if (!template) {
            return res.status(404).json({
                success: false,
                error: 'Plantilla no encontrada'
            });
        }

        res.json({
            success: true,
            template
        });

    } catch (error) {
        logger.error('Error obteniendo plantilla:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno al obtener plantilla',
            message: error.message
        });
    }
});

/**
 * POST /api/360dialog/send-text
 * Enviar mensaje de texto simple
 */
router.post('/send-text', async (req, res) => {
    try {
        const { to, text } = req.body;

        if (!to || !text) {
            return res.status(400).json({
                success: false,
                error: 'Parámetros requeridos: to, text'
            });
        }

        const response = await fetch(`${WABA_API_BASE}/messages`, {
            method: 'POST',
            headers: {
                'D360-API-KEY': DIALOG360_API_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                messaging_product: 'whatsapp',
                to,
                type: 'text',
                text: {
                    body: text
                }
            })
        });

        const data = await response.json();

        if (!response.ok) {
            return res.status(response.status).json({
                success: false,
                error: 'Error enviando mensaje',
                details: data
            });
        }

        logger.info(`✅ Mensaje enviado a ${to}`);
        res.json({
            success: true,
            messageId: data.messages?.[0]?.id,
            data
        });

    } catch (error) {
        logger.error('Error enviando mensaje:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno al enviar mensaje',
            message: error.message
        });
    }
});

/**
 * POST /api/360dialog/send-image
 * Enviar imagen
 */
router.post('/send-image', async (req, res) => {
    try {
        const { to, image, caption } = req.body;

        if (!to || !image) {
            return res.status(400).json({
                success: false,
                error: 'Parámetros requeridos: to, image (url o id)'
            });
        }

        const imageData = typeof image === 'string' 
            ? { link: image }
            : { id: image };

        if (caption) imageData.caption = caption;

        const response = await fetch(`${WABA_API_BASE}/messages`, {
            method: 'POST',
            headers: {
                'D360-API-KEY': DIALOG360_API_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                messaging_product: 'whatsapp',
                to,
                type: 'image',
                image: imageData
            })
        });

        const data = await response.json();

        if (!response.ok) {
            return res.status(response.status).json({
                success: false,
                error: 'Error enviando imagen',
                details: data
            });
        }

        logger.info(`✅ Imagen enviada a ${to}`);
        res.json({
            success: true,
            messageId: data.messages?.[0]?.id,
            data
        });

    } catch (error) {
        logger.error('Error enviando imagen:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno al enviar imagen',
            message: error.message
        });
    }
});

/**
 * POST /api/360dialog/send-video
 * Enviar video
 */
router.post('/send-video', async (req, res) => {
    try {
        const { to, video, caption } = req.body;

        if (!to || !video) {
            return res.status(400).json({
                success: false,
                error: 'Parámetros requeridos: to, video (url o id)'
            });
        }

        const videoData = typeof video === 'string' 
            ? { link: video }
            : { id: video };

        if (caption) videoData.caption = caption;

        const response = await fetch(`${WABA_API_BASE}/messages`, {
            method: 'POST',
            headers: {
                'D360-API-KEY': DIALOG360_API_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                messaging_product: 'whatsapp',
                to,
                type: 'video',
                video: videoData
            })
        });

        const data = await response.json();

        if (!response.ok) {
            return res.status(response.status).json({
                success: false,
                error: 'Error enviando video',
                details: data
            });
        }

        logger.info(`✅ Video enviado a ${to}`);
        res.json({
            success: true,
            messageId: data.messages?.[0]?.id,
            data
        });

    } catch (error) {
        logger.error('Error enviando video:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno al enviar video',
            message: error.message
        });
    }
});

/**
 * POST /api/360dialog/send-audio
 * Enviar audio
 */
router.post('/send-audio', async (req, res) => {
    try {
        const { to, audio } = req.body;

        if (!to || !audio) {
            return res.status(400).json({
                success: false,
                error: 'Parámetros requeridos: to, audio (url o id)'
            });
        }

        const audioData = typeof audio === 'string' 
            ? { link: audio }
            : { id: audio };

        const response = await fetch(`${WABA_API_BASE}/messages`, {
            method: 'POST',
            headers: {
                'D360-API-KEY': DIALOG360_API_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                messaging_product: 'whatsapp',
                to,
                type: 'audio',
                audio: audioData
            })
        });

        const data = await response.json();

        if (!response.ok) {
            return res.status(response.status).json({
                success: false,
                error: 'Error enviando audio',
                details: data
            });
        }

        logger.info(`✅ Audio enviado a ${to}`);
        res.json({
            success: true,
            messageId: data.messages?.[0]?.id,
            data
        });

    } catch (error) {
        logger.error('Error enviando audio:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno al enviar audio',
            message: error.message
        });
    }
});

/**
 * POST /api/360dialog/send-document
 * Enviar documento
 */
router.post('/send-document', async (req, res) => {
    try {
        const { to, document, caption, filename } = req.body;

        if (!to || !document) {
            return res.status(400).json({
                success: false,
                error: 'Parámetros requeridos: to, document (url o id)'
            });
        }

        const docData = typeof document === 'string' 
            ? { link: document }
            : { id: document };

        if (caption) docData.caption = caption;
        if (filename) docData.filename = filename;

        const response = await fetch(`${WABA_API_BASE}/messages`, {
            method: 'POST',
            headers: {
                'D360-API-KEY': DIALOG360_API_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                messaging_product: 'whatsapp',
                to,
                type: 'document',
                document: docData
            })
        });

        const data = await response.json();

        if (!response.ok) {
            return res.status(response.status).json({
                success: false,
                error: 'Error enviando documento',
                details: data
            });
        }

        logger.info(`✅ Documento enviado a ${to}`);
        res.json({
            success: true,
            messageId: data.messages?.[0]?.id,
            data
        });

    } catch (error) {
        logger.error('Error enviando documento:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno al enviar documento',
            message: error.message
        });
    }
});

/**
 * POST /api/360dialog/send-url-button
 * Enviar botón con URL (Call to Action)
 * Requiere usar un template aprobado con botón de URL
 */
router.post('/send-url-button', async (req, res) => {
    try {
        const { to, templateName, language, url, buttonText } = req.body;

        if (!to || !templateName) {
            return res.status(400).json({
                success: false,
                error: 'Parámetros requeridos: to, templateName'
            });
        }

        // Enviar template con botón de URL
        const response = await fetch(`${WABA_API_BASE}/messages`, {
            method: 'POST',
            headers: {
                'D360-API-KEY': DIALOG360_API_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                messaging_product: 'whatsapp',
                to,
                type: 'template',
                template: {
                    name: templateName,
                    language: language || { code: 'es' },
                    components: url ? [{
                        type: 'button',
                        sub_type: 'url',
                        index: '0',
                        parameters: [{
                            type: 'text',
                            text: url
                        }]
                    }] : []
                }
            })
        });

        const data = await response.json();

        if (!response.ok) {
            return res.status(response.status).json({
                success: false,
                error: 'Error enviando botón con URL',
                details: data
            });
        }

        logger.info(`✅ Botón con URL enviado a ${to}`);
        res.json({ success: true, messageId: data.messages?.[0]?.id, data });

    } catch (error) {
        logger.error('Error enviando botón con URL:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno',
            message: error.message
        });
    }
});

/**
 * POST /api/360dialog/send-buttons
 * Enviar botones interactivos
 */
router.post('/send-buttons', async (req, res) => {
    try {
        const { to, body, buttons, header, footer } = req.body;

        if (!to || !body || !buttons || !Array.isArray(buttons)) {
            return res.status(400).json({
                success: false,
                error: 'Parámetros requeridos: to, body, buttons (array)'
            });
        }

        const interactive = {
            type: 'button',
            body: { text: body }
        };

        if (header) interactive.header = { type: 'text', text: header };
        if (footer) interactive.footer = { text: footer };

        interactive.action = {
            buttons: buttons.map((btn, idx) => ({
                type: 'reply',
                reply: {
                    id: btn.id || `btn_${idx}`,
                    title: btn.title
                }
            }))
        };

        const response = await fetch(`${WABA_API_BASE}/messages`, {
            method: 'POST',
            headers: {
                'D360-API-KEY': DIALOG360_API_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                messaging_product: 'whatsapp',
                to,
                type: 'interactive',
                interactive
            })
        });

        const data = await response.json();

        if (!response.ok) {
            return res.status(response.status).json({
                success: false,
                error: 'Error enviando botones',
                details: data
            });
        }

        logger.info(`✅ Botones enviados a ${to}`);
        res.json({
            success: true,
            messageId: data.messages?.[0]?.id,
            data
        });

    } catch (error) {
        logger.error('Error enviando botones:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno al enviar botones',
            message: error.message
        });
    }
});

/**
 * POST /api/360dialog/send-list
 * Enviar lista interactiva
 */
router.post('/send-list', async (req, res) => {
    try {
        const { to, body, button, sections, header, footer } = req.body;

        if (!to || !body || !button || !sections || !Array.isArray(sections)) {
            return res.status(400).json({
                success: false,
                error: 'Parámetros requeridos: to, body, button, sections (array)'
            });
        }

        const interactive = {
            type: 'list',
            body: { text: body }
        };

        if (header) interactive.header = { type: 'text', text: header };
        if (footer) interactive.footer = { text: footer };

        interactive.action = {
            button: button,
            sections: sections
        };

        const response = await fetch(`${WABA_API_BASE}/messages`, {
            method: 'POST',
            headers: {
                'D360-API-KEY': DIALOG360_API_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                messaging_product: 'whatsapp',
                to,
                type: 'interactive',
                interactive
            })
        });

        const data = await response.json();

        if (!response.ok) {
            return res.status(response.status).json({
                success: false,
                error: 'Error enviando lista',
                details: data
            });
        }

        logger.info(`✅ Lista enviada a ${to}`);
        res.json({
            success: true,
            messageId: data.messages?.[0]?.id,
            data
        });

    } catch (error) {
        logger.error('Error enviando lista:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno al enviar lista',
            message: error.message
        });
    }
});

/**
 * POST /api/360dialog/upload-media
 * Subir archivo multimedia
 */
router.post('/upload-media', async (req, res) => {
    try {
        const { file, type } = req.body;

        if (!file) {
            return res.status(400).json({
                success: false,
                error: 'Parámetro requerido: file (base64 o url)'
            });
        }

        // Para upload real necesitarías usar FormData con multipart/form-data
        // Esta es una implementación simplificada
        const response = await fetch(`${WABA_API_BASE}/media`, {
            method: 'POST',
            headers: {
                'D360-API-KEY': DIALOG360_API_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                messaging_product: 'whatsapp',
                file,
                type
            })
        });

        const data = await response.json();

        if (!response.ok) {
            return res.status(response.status).json({
                success: false,
                error: 'Error subiendo media',
                details: data
            });
        }

        logger.info(`✅ Media subido: ${data.id}`);
        res.json({
            success: true,
            mediaId: data.id,
            data
        });

    } catch (error) {
        logger.error('Error subiendo media:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno al subir media',
            message: error.message
        });
    }
});

/**
 * POST /api/360dialog/send-template
 * Enviar plantilla/flow con soporte completo para todos los tipos de botones
 * Tipos soportados: Quick Reply, Call to Action (URL/Phone), Copy Code, OTP, FLOW
 */
router.post('/send-template', async (req, res) => {
    try {
        const { to, template } = req.body;

        if (!to || !template?.name) {
            return res.status(400).json({
                success: false,
                error: 'Parámetros requeridos: to, template.name'
            });
        }

        // Construir objeto de template
        const templateData = {
            name: template.name,
            language: template.language || { code: 'es' }
        };

        // Procesar componentes si existen
        if (template.components && template.components.length > 0) {
            templateData.components = template.components;
        }

        // Helper para crear componentes de botones Flow
        if (template.flow_button) {
            const flowComponent = {
                type: 'button',
                sub_type: 'flow',
                index: '0',
                parameters: [{
                    type: 'action',
                    action: {
                        flow_token: template.flow_button.flow_token || `FLOW_TOKEN_${Date.now()}`,
                        ...(template.flow_button.flow_action_data && { 
                            flow_action_data: template.flow_button.flow_action_data 
                        })
                    }
                }]
            };
            
            templateData.components = templateData.components || [];
            templateData.components.push(flowComponent);
        }

        const response = await fetch(`${WABA_API_BASE}/messages`, {
            method: 'POST',
            headers: {
                'D360-API-KEY': DIALOG360_API_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                messaging_product: 'whatsapp',
                to,
                type: 'template',
                template: templateData
            })
        });

        const data = await response.json();

        if (!response.ok) {
            return res.status(response.status).json({
                success: false,
                error: 'Error enviando plantilla',
                details: data
            });
        }

        logger.info(`✅ Plantilla "${template.name}" enviada a ${to}`);
        res.json({
            success: true,
            messageId: data.messages?.[0]?.id,
            data
        });

    } catch (error) {
        logger.error('Error enviando plantilla:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno al enviar plantilla',
            message: error.message
        });
    }
});

/**
 * GET /api/360dialog/template-examples
 * Obtener ejemplos de uso para cada tipo de template
 */
router.get('/template-examples', (req, res) => {
    res.json({
        success: true,
        message: 'Ver documentación completa en CREAR_CUALQUIER_TEMPLATE_OFICIAL.md',
        endpoint: 'POST https://waba-v2.360dialog.io/v1/configs/templates',
        examples: {
            basic_text: {
                to: '573113705258',
                template: {
                    name: 'hello_world',
                    language: { code: 'es' }
                }
            },
            with_variables: {
                to: '573113705258',
                template: {
                    name: 'order_confirmation',
                    language: { code: 'es' },
                    components: [
                        {
                            type: 'body',
                            parameters: [
                                { type: 'text', text: 'Juan Pérez' },
                                { type: 'text', text: '12345' }
                            ]
                        }
                    ]
                }
            },
            quick_reply_button: {
                to: '573113705258',
                template: {
                    name: 'support_menu',
                    language: { code: 'es' },
                    components: [
                        {
                            type: 'button',
                            sub_type: 'quick_reply',
                            index: '0',
                            parameters: [
                                {
                                    type: 'payload',
                                    payload: 'YES'
                                }
                            ]
                        }
                    ]
                }
            },
            phone_button: {
                to: '573113705258',
                template: {
                    name: 'call_support',
                    language: { code: 'es' }
                }
            },
            copy_code: {
                to: '573113705258',
                template: {
                    name: 'discount_code',
                    language: { code: 'es' },
                    components: [
                        {
                            type: 'button',
                            sub_type: 'copy_code',
                            index: '0',
                            parameters: [
                                {
                                    type: 'coupon_code',
                                    coupon_code: 'SAVE20'
                                }
                            ]
                        }
                    ]
                }
            },
            otp: {
                to: '573113705258',
                template: {
                    name: 'authentication',
                    language: { code: 'es' },
                    components: [
                        {
                            type: 'button',
                            sub_type: 'otp',
                            index: '0',
                            parameters: [
                                {
                                    type: 'otp',
                                    otp: '123456'
                                }
                            ]
                        }
                    ]
                }
            },
            flow_button: {
                to: '573113705258',
                template: {
                    name: 'prueba',
                    language: { code: 'en' },
                    flow_button: {
                        flow_token: `FLOW_TOKEN_${Date.now()}`,
                        flow_action_data: {
                            screen: 'SIGN_UP'
                        }
                    }
                }
            },
            complete_template: {
                to: '573113705258',
                template: {
                    name: 'order_status',
                    language: { code: 'es' },
                    components: [
                        {
                            type: 'header',
                            parameters: [
                                {
                                    type: 'image',
                                    image: {
                                        link: 'https://example.com/package.jpg'
                                    }
                                }
                            ]
                        },
                        {
                            type: 'body',
                            parameters: [
                                { type: 'text', text: 'Juan' },
                                { type: 'text', text: 'ORD-123' },
                                { type: 'text', text: 'En camino' }
                            ]
                        },
                        {
                            type: 'button',
                            sub_type: 'url',
                            index: '0',
                            parameters: [
                                {
                                    type: 'text',
                                    text: 'ORD-123'
                                }
                            ]
                        }
                    ]
                }
            }
        }
    });
});

/**
 * POST /api/360dialog/create-template
 * Crear un template y enviarlo a aprobación automáticamente
 * Endpoint oficial: https://waba-v2.360dialog.io/v1/configs/templates
 */
router.post('/create-template', async (req, res) => {
    try {
        const { name, category, language, components, allow_category_change } = req.body;

        if (!name || !category || !language) {
            return res.status(400).json({
                success: false,
                error: 'Parámetros requeridos: name, category, language'
            });
        }

        // Usar endpoint oficial de templates
        const response = await fetch(`${WABA_API_BASE}/v1/configs/templates`, {
            method: 'POST',
            headers: {
                'D360-API-KEY': DIALOG360_API_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name,
                category,
                language,
                allow_category_change: allow_category_change !== false, // true por defecto
                components: components || []
            })
        });

        const data = await response.json();

        if (!response.ok) {
            return res.status(response.status).json({
                success: false,
                error: 'Error creando template',
                details: data
            });
        }

        logger.info(`✅ Template draft "${name}" creado`);
        res.json({
            success: true,
            template: data,
            message: 'Template creado en estado draft. Debe ser aprobado por WhatsApp.'
        });

    } catch (error) {
        logger.error('Error creando template:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno al crear template',
            message: error.message
        });
    }
});

/**
 * POST /api/360dialog/send-product
 * Enviar mensaje de producto simple
 */
router.post('/send-product', async (req, res) => {
    try {
        const { to, catalogId, productId, body, footer } = req.body;

        if (!to || !catalogId || !productId) {
            return res.status(400).json({
                success: false,
                error: 'Parámetros requeridos: to, catalogId, productId'
            });
        }

        const interactive = {
            type: 'product',
            body: { text: body || 'Ver producto' }
        };

        if (footer) interactive.footer = { text: footer };

        interactive.action = {
            catalog_id: catalogId,
            product_retailer_id: productId
        };

        const response = await fetch(`${WABA_API_BASE}/messages`, {
            method: 'POST',
            headers: {
                'D360-API-KEY': DIALOG360_API_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                messaging_product: 'whatsapp',
                to,
                type: 'interactive',
                interactive
            })
        });

        const data = await response.json();

        if (!response.ok) {
            return res.status(response.status).json({
                success: false,
                error: 'Error enviando producto',
                details: data
            });
        }

        logger.info(`✅ Producto enviado a ${to}`);
        res.json({ success: true, messageId: data.messages?.[0]?.id, data });

    } catch (error) {
        logger.error('Error enviando producto:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno',
            message: error.message
        });
    }
});

/**
 * POST /api/360dialog/send-multi-product
 * Enviar mensaje multi-producto
 */
router.post('/send-multi-product', async (req, res) => {
    try {
        const { to, catalogId, sections, header, body, footer } = req.body;

        if (!to || !catalogId || !sections) {
            return res.status(400).json({
                success: false,
                error: 'Parámetros requeridos: to, catalogId, sections'
            });
        }

        const interactive = {
            type: 'product_list',
            header: { type: 'text', text: header || 'Nuestros Productos' },
            body: { text: body || 'Selecciona un producto' }
        };

        if (footer) interactive.footer = { text: footer };

        interactive.action = {
            catalog_id: catalogId,
            sections: sections
        };

        const response = await fetch(`${WABA_API_BASE}/messages`, {
            method: 'POST',
            headers: {
                'D360-API-KEY': DIALOG360_API_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                messaging_product: 'whatsapp',
                to,
                type: 'interactive',
                interactive
            })
        });

        const data = await response.json();

        if (!response.ok) {
            return res.status(response.status).json({
                success: false,
                error: 'Error enviando multi-producto',
                details: data
            });
        }

        logger.info(`✅ Multi-producto enviado a ${to}`);
        res.json({ success: true, messageId: data.messages?.[0]?.id, data });

    } catch (error) {
        logger.error('Error enviando multi-producto:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno',
            message: error.message
        });
    }
});

/**
 * POST /api/360dialog/send-location-request
 * Solicitar ubicación al usuario
 */
router.post('/send-location-request', async (req, res) => {
    try {
        const { to, body } = req.body;

        if (!to) {
            return res.status(400).json({
                success: false,
                error: 'Parámetro requerido: to'
            });
        }

        const response = await fetch(`${WABA_API_BASE}/messages`, {
            method: 'POST',
            headers: {
                'D360-API-KEY': DIALOG360_API_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to,
                type: 'interactive',
                interactive: {
                    type: 'location_request_message',
                    body: { text: body || 'Comparte tu ubicación' },
                    action: { name: 'send_location' }
                }
            })
        });

        const data = await response.json();

        if (!response.ok) {
            return res.status(response.status).json({
                success: false,
                error: 'Error solicitando ubicación',
                details: data
            });
        }

        logger.info(`✅ Solicitud de ubicación enviada a ${to}`);
        res.json({ success: true, messageId: data.messages?.[0]?.id, data });

    } catch (error) {
        logger.error('Error solicitando ubicación:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno',
            message: error.message
        });
    }
});

/**
 * POST /api/360dialog/send-url-preview
 * Enviar mensaje con preview de URL
 */
router.post('/send-url-preview', async (req, res) => {
    try {
        const { to, text, url } = req.body;

        if (!to || (!text && !url)) {
            return res.status(400).json({
                success: false,
                error: 'Parámetros requeridos: to, text o url'
            });
        }

        const body = text || url;

        const response = await fetch(`${WABA_API_BASE}/messages`, {
            method: 'POST',
            headers: {
                'D360-API-KEY': DIALOG360_API_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                messaging_product: 'whatsapp',
                to,
                type: 'text',
                text: {
                    preview_url: true,
                    body: body
                }
            })
        });

        const data = await response.json();

        if (!response.ok) {
            return res.status(response.status).json({
                success: false,
                error: 'Error enviando URL',
                details: data
            });
        }

        logger.info(`✅ URL con preview enviada a ${to}`);
        res.json({ success: true, messageId: data.messages?.[0]?.id, data });

    } catch (error) {
        logger.error('Error enviando URL:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno',
            message: error.message
        });
    }
});

/**
 * POST /api/360dialog/send-contact
 * Enviar mensaje de contacto
 */
router.post('/send-contact', async (req, res) => {
    try {
        const { to, contacts } = req.body;

        if (!to || !contacts || !Array.isArray(contacts)) {
            return res.status(400).json({
                success: false,
                error: 'Parámetros requeridos: to, contacts (array)'
            });
        }

        const response = await fetch(`${WABA_API_BASE}/messages`, {
            method: 'POST',
            headers: {
                'D360-API-KEY': DIALOG360_API_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                messaging_product: 'whatsapp',
                to,
                type: 'contacts',
                contacts: contacts
            })
        });

        const data = await response.json();

        if (!response.ok) {
            return res.status(response.status).json({
                success: false,
                error: 'Error enviando contacto',
                details: data
            });
        }

        logger.info(`✅ Contacto enviado a ${to}`);
        res.json({ success: true, messageId: data.messages?.[0]?.id, data });

    } catch (error) {
        logger.error('Error enviando contacto:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno',
            message: error.message
        });
    }
});

/**
 * GET /api/360dialog/call-permission/:phone
 * Solicitar autorización de llamada simple
 */
router.get('/call-permission/:phone', async (req, res) => {
    try {
        const { phone } = req.params;

        if (!phone) {
            return res.status(400).json({
                success: false,
                error: 'Parámetro requerido: phone'
            });
        }

        const response = await fetch(`${WABA_API_BASE}/calling/permissions/${phone}`, {
            method: 'GET',
            headers: {
                'D360-API-KEY': DIALOG360_API_KEY
            }
        });

        const data = await response.json();

        if (!response.ok) {
            return res.status(response.status).json({
                success: false,
                error: 'Error solicitando permiso de llamada',
                details: data
            });
        }

        logger.info(`✅ Permiso de llamada solicitado a ${phone}`);
        res.json({ success: true, data });

    } catch (error) {
        logger.error('Error solicitando permiso:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno',
            message: error.message
        });
    }
});

/**
 * GET /api/360dialog/list-flows
 * Listar todos los flows con más detalles
 */
router.get('/list-flows', async (req, res) => {
    try {
        const { fields } = req.query;

        if (!PARTNER_ID || !WABA_ACCOUNT_ID) {
            return res.status(500).json({
                success: false,
                error: 'PARTNER_ID o WABA_ACCOUNT_ID no configurados'
            });
        }

        let url = `${HUB_API_BASE}/api/v2/partners/${PARTNER_ID}/waba_accounts/${WABA_ACCOUNT_ID}/flows`;
        
        if (fields) {
            url += `?fields=${fields}`;
        }

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'X-API-KEY': DIALOG360_PARTNER_API_KEY
            }
        });

        const data = await response.json();

        if (!response.ok) {
            return res.status(response.status).json({
                success: false,
                error: 'Error obteniendo flows',
                details: data
            });
        }

        logger.info(`✅ Flows listados: ${data.data?.length || 0}`);
        res.json({
            success: true,
            count: data.data?.length || 0,
            flows: data.data,
            data
        });

    } catch (error) {
        logger.error('Error listando flows:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno',
            message: error.message
        });
    }
});

/**
 * GET /api/360dialog/get-flow/:flowId
 * Obtener detalles de un flow específico
 */
router.get('/get-flow/:flowId', async (req, res) => {
    try {
        const { flowId } = req.params;

        if (!PARTNER_ID || !WABA_ACCOUNT_ID) {
            return res.status(500).json({
                success: false,
                error: 'PARTNER_ID o WABA_ACCOUNT_ID no configurados'
            });
        }

        const response = await fetch(
            `${HUB_API_BASE}/api/v2/partners/${PARTNER_ID}/waba_accounts/${WABA_ACCOUNT_ID}/flows/${flowId}`,
            {
                method: 'GET',
                headers: {
                    'X-API-KEY': DIALOG360_PARTNER_API_KEY
                }
            }
        );

        const data = await response.json();

        if (!response.ok) {
            return res.status(response.status).json({
                success: false,
                error: 'Error obteniendo flow',
                details: data
            });
        }

        logger.info(`✅ Flow ${flowId} obtenido`);
        res.json({ success: true, flow: data });

    } catch (error) {
        logger.error('Error obteniendo flow:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno',
            message: error.message
        });
    }
});

/**
 * POST /api/360dialog/create-flow
 * Crear un Flow nuevo (como borrador)
 */
router.post('/create-flow', async (req, res) => {
    try {
        const { name, categories, endpoint_uri } = req.body;

        if (!name || !categories) {
            return res.status(400).json({
                success: false,
                error: 'Parámetros requeridos: name, categories'
            });
        }

        const response = await fetch(
            'https://hub.360dialog.io/api/v2/partners/srMmoqPA/waba_accounts/FFCPLwWA/flows',
            {
                method: 'POST',
                headers: {
                    'x-api-key': DIALOG360_API_KEY,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name,
                    categories,
                    endpoint_uri: endpoint_uri || ''
                })
            }
        );

        const data = await response.json();

        if (!response.ok) {
            return res.status(response.status).json({
                success: false,
                error: 'Error creando Flow',
                details: data
            });
        }

        logger.info(`✅ Flow creado: ${name} (ID: ${data.id})`);
        res.json({
            success: true,
            flow: data,
            message: 'Flow creado como borrador. Actualiza el JSON con /update-flow-assets'
        });

    } catch (error) {
        logger.error('Error creando Flow:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno',
            message: error.message
        });
    }
});

/**
 * POST /api/360dialog/update-flow-assets/:flowId
 * Actualizar el JSON de un Flow
 */
router.post('/update-flow-assets/:flowId', async (req, res) => {
    try {
        const { flowId } = req.params;
        const { flow_json } = req.body;

        if (!flow_json) {
            return res.status(400).json({
                success: false,
                error: 'Parámetro requerido: flow_json'
            });
        }

        // Crear form-data
        const FormData = (await import('form-data')).default;
        const form = new FormData();
        form.append('file', JSON.stringify(flow_json), {
            filename: 'flow.json',
            contentType: 'application/json'
        });

        const response = await fetch(
            `https://hub.360dialog.io/api/v2/partners/srMmoqPA/waba_accounts/FFCPLwWA/flows/${flowId}/assets`,
            {
                method: 'POST',
                headers: {
                    'x-api-key': DIALOG360_API_KEY,
                    ...form.getHeaders()
                },
                body: form
            }
        );

        const data = await response.json();

        if (!response.ok) {
            return res.status(response.status).json({
                success: false,
                error: 'Error actualizando Flow',
                details: data
            });
        }

        logger.info(`✅ Flow actualizado: ${flowId}`);
        res.json({ success: true, data });

    } catch (error) {
        logger.error('Error actualizando Flow:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno',
            message: error.message
        });
    }
});

/**
 * GET /api/360dialog/flow-preview/:flowId
 * Generar preview de un Flow
 * Query params: invalidate=true (regenerar link)
 */
router.get('/flow-preview/:flowId', async (req, res) => {
    try {
        const { flowId } = req.params;
        const { invalidate } = req.query;

        const url = new URL(`https://hub.360dialog.io/api/v2/partners/srMmoqPA/waba_accounts/FFCPLwWA/flows/${flowId}/preview`);
        if (invalidate === 'true') {
            url.searchParams.append('invalidate', 'true');
        }

        const response = await fetch(url.toString(), {
            method: 'GET',
            headers: {
                'x-api-key': DIALOG360_API_KEY
            }
        });

        const data = await response.json();

        if (!response.ok) {
            return res.status(response.status).json({
                success: false,
                error: 'Error obteniendo preview',
                details: data
            });
        }

        res.json({ 
            success: true, 
            preview: data.preview,
            preview_url: data.preview?.preview_url,
            expires_at: data.preview?.expires_at
        });

    } catch (error) {
        logger.error('Error obteniendo preview:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno',
            message: error.message
        });
    }
});

/**
 * DELETE /api/360dialog/delete-flow/:flowId
 * Eliminar un Flow
 */
router.delete('/delete-flow/:flowId', async (req, res) => {
    try {
        const { flowId } = req.params;

        const response = await fetch(
            `https://hub.360dialog.io/api/v2/partners/srMmoqPA/waba_accounts/FFCPLwWA/flows/${flowId}`,
            {
                method: 'DELETE',
                headers: {
                    'x-api-key': DIALOG360_API_KEY
                }
            }
        );

        if (!response.ok) {
            const data = await response.json();
            return res.status(response.status).json({
                success: false,
                error: 'Error eliminando Flow',
                details: data
            });
        }

        logger.info(`✅ Flow eliminado: ${flowId}`);
        res.json({ success: true, message: 'Flow eliminado correctamente' });

    } catch (error) {
        logger.error('Error eliminando Flow:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno',
            message: error.message
        });
    }
});

export default router;

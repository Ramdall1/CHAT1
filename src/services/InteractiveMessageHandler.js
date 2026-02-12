/**
 * Interactive Message Handler
 * Manejo especializado de mensajes interactivos de WhatsApp
 * (Botones, Listas, Flows, etc.)
 */

import { createLogger } from './core/core/logger.js';

const logger = createLogger('INTERACTIVE_HANDLER');

class InteractiveMessageHandler {
    constructor() {
        this.responseHandlers = new Map();
        this.flowDataProcessors = new Map();
    }

    /**
     * Procesar mensaje interactivo
     */
    async processInteractiveMessage(message, appLocals) {
        const { interactive, from, id: messageId, timestamp } = message;

        if (!interactive || !interactive.type) {
            logger.warn('Mensaje interactivo sin tipo', { from, messageId });
            return;
        }

        logger.info(`📱 Mensaje interactivo recibido de ${from}`, {
            type: interactive.type,
            messageId
        });

        try {
            switch (interactive.type) {
                case 'button_reply':
                    await this.handleButtonReply(interactive.button_reply, from, messageId, appLocals);
                    break;

                case 'list_reply':
                    await this.handleListReply(interactive.list_reply, from, messageId, appLocals);
                    break;

                case 'nfm_reply':
                    await this.handleFlowReply(interactive.nfm_reply, from, messageId, appLocals);
                    break;

                default:
                    logger.warn(`Tipo de mensaje interactivo no manejado: ${interactive.type}`, {
                        from,
                        messageId
                    });
            }

            // Registrar en analytics
            this.trackInteractiveMessage(interactive.type, from);

        } catch (error) {
            logger.error('Error procesando mensaje interactivo:', error);
            throw error;
        }
    }

    /**
     * Manejar respuesta de botón
     */
    async handleButtonReply(buttonReply, from, messageId, appLocals) {
        const { id: buttonId, title } = buttonReply;

        logger.info(`🔘 Botón presionado por ${from}`, {
            buttonId,
            title,
            messageId
        });

        // Guardar respuesta
        if (appLocals.localMessagingService) {
            await appLocals.localMessagingService.saveInteractiveResponse({
                from,
                messageId,
                type: 'button_reply',
                data: {
                    buttonId,
                    title
                },
                timestamp: new Date()
            });
        }

        // Emitir evento
        if (appLocals.io) {
            appLocals.io.emit('button_pressed', {
                from,
                buttonId,
                title,
                timestamp: new Date().toISOString()
            });
        }

        // Procesar acción del botón
        await this.executeButtonAction(buttonId, from, appLocals);
    }

    /**
     * Manejar respuesta de lista
     */
    async handleListReply(listReply, from, messageId, appLocals) {
        const { id: listId, title, description } = listReply;

        logger.info(`📋 Opción de lista seleccionada por ${from}`, {
            listId,
            title,
            messageId
        });

        // Guardar respuesta
        if (appLocals.localMessagingService) {
            await appLocals.localMessagingService.saveInteractiveResponse({
                from,
                messageId,
                type: 'list_reply',
                data: {
                    listId,
                    title,
                    description
                },
                timestamp: new Date()
            });
        }

        // Emitir evento
        if (appLocals.io) {
            appLocals.io.emit('list_option_selected', {
                from,
                listId,
                title,
                description,
                timestamp: new Date().toISOString()
            });
        }

        // Procesar acción de la lista
        await this.executeListAction(listId, from, appLocals);
    }

    /**
     * Manejar respuesta de Flow (NFM Reply)
     */
    async handleFlowReply(nfmReply, from, messageId, appLocals) {
        const { name: flowName, response_json } = nfmReply;

        // VALIDACIÓN COMPLETA del nfmReply
        logger.info('🔍 [InteractiveMessageHandler] Flow Reply recibido:', {
            from,
            messageId,
            has_name: !!flowName,
            flow_name: flowName,
            has_response_json: !!response_json,
            response_json_type: typeof response_json,
            nfm_reply_structure: {
                name: !!nfmReply.name,
                response_json: !!nfmReply.response_json,
                body: !!nfmReply.body,
                other_fields: Object.keys(nfmReply).filter(k => k !== 'name' && k !== 'response_json')
            }
        });

        if (!response_json) {
            logger.error('❌ Flow response sin response_json', { 
                from, 
                flowName,
                nfm_reply_keys: Object.keys(nfmReply),
                full_nfm_reply: JSON.stringify(nfmReply, null, 2)
            });
            return;
        }

        const { flow_token, ...formData } = response_json;

        logger.info(`🔄 Respuesta de Flow "${flowName}" recibida de ${from}`, {
            flowToken: flow_token ? '✅ Present' : '❌ Missing',
            flowToken_value: flow_token,
            hasFormData: Object.keys(formData).length > 0,
            formFieldsCount: Object.keys(formData).length,
            formFieldNames: Object.keys(formData),
            messageId
        });

        // Log detallado del response_json COMPLETO
        logger.info('📊 [COMPLETE DATA] Datos del Flow:', {
            flowName,
            flowToken: flow_token,
            formData: JSON.stringify(formData, null, 2),
            raw_response_json: JSON.stringify(response_json, null, 2)
        });

        // Guardar respuesta completa
        if (appLocals.localMessagingService) {
            await appLocals.localMessagingService.saveFlowResponse({
                from,
                messageId,
                flowName,
                flowToken: flow_token,
                responseData: response_json,
                formData,
                timestamp: new Date()
            });
        }

        // Emitir evento con datos completos
        if (appLocals.io) {
            appLocals.io.emit('flow_response_received', {
                from,
                flowName,
                flowToken: flow_token,
                responseData: response_json,
                formData,
                timestamp: new Date().toISOString()
            });
        }

        // Procesar datos del formulario
        await this.processFlowData(flowName, formData, from, appLocals);

        // Ejecutar custom processors si están registrados
        if (this.flowDataProcessors.has(flowName)) {
            const processor = this.flowDataProcessors.get(flowName);
            await processor(formData, from, appLocals);
        }
    }

    /**
     * Procesar datos del formulario de Flow
     */
    async processFlowData(flowName, formData, from, appLocals) {
        logger.info(`📝 Procesando datos de Flow "${flowName}"`, {
            from,
            fieldCount: Object.keys(formData).length
        });

        // Actualizar contacto con datos del formulario
        if (appLocals.localContactManager && Object.keys(formData).length > 0) {
            const contactUpdate = {};

            // Mapear campos comunes
            if (formData.name || formData.nombre) {
                contactUpdate.name = formData.name || formData.nombre;
            }
            if (formData.email || formData.correo) {
                contactUpdate.email = formData.email || formData.correo;
            }
            if (formData.phone || formData.telefono) {
                contactUpdate.additionalPhone = formData.phone || formData.telefono;
            }

            // Guardar datos completos del flow en custom fields
            contactUpdate.flowData = {
                [flowName]: {
                    ...formData,
                    timestamp: new Date().toISOString()
                }
            };

            try {
                await appLocals.localContactManager.updateContact(from, contactUpdate);
                logger.info(`✅ Contacto ${from} actualizado con datos de Flow "${flowName}"`);
            } catch (error) {
                logger.error('Error actualizando contacto con datos de Flow:', error);
            }
        }

        // Guardar en custom fields individuales si existen
        if (appLocals.db) {
            for (const [fieldName, fieldValue] of Object.entries(formData)) {
                try {
                    await this.saveCustomField(from, flowName, fieldName, fieldValue, appLocals.db);
                } catch (error) {
                    logger.warn(`Error guardando custom field ${fieldName}:`, error);
                }
            }
        }
    }

    /**
     * Guardar custom field
     */
    async saveCustomField(phone, flowName, fieldName, fieldValue, db) {
        const query = `
            INSERT OR REPLACE INTO contact_custom_fields (phone, field_name, field_value, source, updated_at)
            VALUES (?, ?, ?, ?, datetime('now'))
        `;

        return new Promise((resolve, reject) => {
            db.run(query, [
                phone,
                `${flowName}_${fieldName}`,
                JSON.stringify(fieldValue),
                'flow_response'
            ], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    /**
     * Ejecutar acción de botón
     */
    async executeButtonAction(buttonId, from, appLocals) {
        // Implementar lógica según el ID del botón
        logger.debug(`Ejecutando acción para botón: ${buttonId}`);

        if (this.responseHandlers.has(buttonId)) {
            const handler = this.responseHandlers.get(buttonId);
            await handler(from, appLocals);
        }
    }

    /**
     * Ejecutar acción de lista
     */
    async executeListAction(listId, from, appLocals) {
        // Implementar lógica según el ID de la lista
        logger.debug(`Ejecutando acción para opción de lista: ${listId}`);

        if (this.responseHandlers.has(listId)) {
            const handler = this.responseHandlers.get(listId);
            await handler(from, appLocals);
        }
    }

    /**
     * Registrar handler para botón o lista
     */
    registerResponseHandler(id, handler) {
        this.responseHandlers.set(id, handler);
        logger.info(`Handler registrado para: ${id}`);
    }

    /**
     * Registrar processor para datos de Flow
     */
    registerFlowDataProcessor(flowName, processor) {
        this.flowDataProcessors.set(flowName, processor);
        logger.info(`Processor de datos registrado para Flow: ${flowName}`);
    }

    /**
     * Track analytics
     */
    trackInteractiveMessage(type, from) {
        // Implementar tracking de analytics
        logger.debug(`Tracking: ${type} de ${from}`);
    }

    /**
     * Obtener estadísticas de mensajes interactivos
     */
    async getStats(db) {
        const query = `
            SELECT 
                type,
                COUNT(*) as total,
                DATE(timestamp) as date
            FROM interactive_responses
            GROUP BY type, DATE(timestamp)
            ORDER BY timestamp DESC
            LIMIT 30
        `;

        return new Promise((resolve, reject) => {
            db.all(query, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }
}

// Singleton instance
export const interactiveMessageHandler = new InteractiveMessageHandler();

export default InteractiveMessageHandler;

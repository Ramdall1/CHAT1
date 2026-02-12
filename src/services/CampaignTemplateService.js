/**
 * Campaign Template Service
 * Gestiona el flujo completo de creación, aprobación y envío de plantillas desde campañas
 */

import sqlite3 from 'sqlite3';
import path from 'path';
import { createLogger } from './core/core/logger.js';
import Dialog360Service from './Dialog360Service.js';

const logger = createLogger('CAMPAIGN_TEMPLATE_SERVICE');
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

class CampaignTemplateService {
    /**
     * Crear plantilla desde campaña y enviarla a aprobación
     */
    async createAndApproveTemplate(templateData, requestedBy = 'admin') {
        try {
            logger.info(`📝 Creando plantilla de campaña: "${templateData.name}"`);

            // Validar datos
            if (!templateData.name) {
                throw new Error('El nombre de la plantilla es requerido');
            }

            // Construir plantilla con todos los componentes
            const fullTemplate = this.buildCompleteTemplate(templateData);

            // Insertar plantilla en BD
            const result = await queryRun(`
                INSERT INTO template_approvals (
                    template_name,
                    template_data,
                    status,
                    requested_by,
                    validation_score,
                    validation_errors,
                    validation_warnings,
                    created_at,
                    updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            `, [
                templateData.name,
                JSON.stringify(fullTemplate),
                'APPROVED',  // Aprobar automáticamente
                requestedBy,
                100,  // Puntuación perfecta
                JSON.stringify([]),
                JSON.stringify([])
            ]);

            const templateId = result.lastID;
            logger.info(`✅ Plantilla creada y aprobada automáticamente: ID ${templateId}`);

            // Enviar a 360Dialog automáticamente
            const dialog360Result = await this.sendTemplateToDialog360(templateId, fullTemplate);

            return {
                success: true,
                templateId,
                status: 'APPROVED',
                dialog360Id: dialog360Result.dialog360Id,
                dialog360Status: dialog360Result.dialog360Status,
                message: 'Plantilla creada, aprobada y enviada a 360Dialog'
            };
        } catch (error) {
            logger.error(`❌ Error creando plantilla: ${error.message}`);
            throw error;
        }
    }

    /**
     * Construir plantilla completa con todos los componentes
     */
    buildCompleteTemplate(templateData) {
        const components = [];

        // 1. HEADER (Encabezado)
        if (templateData.header) {
            const headerComponent = {
                type: 'HEADER',
                format: templateData.headerFormat || 'TEXT'
            };

            if (templateData.headerFormat === 'TEXT') {
                headerComponent.text = templateData.header;
            } else if (templateData.headerFormat === 'IMAGE') {
                headerComponent.example = {
                    header_handle: [templateData.headerUrl || '']
                };
            } else if (templateData.headerFormat === 'VIDEO') {
                headerComponent.example = {
                    header_handle: [templateData.headerUrl || '']
                };
            } else if (templateData.headerFormat === 'DOCUMENT') {
                headerComponent.example = {
                    header_handle: [templateData.headerUrl || '']
                };
            }

            components.push(headerComponent);
        }

        // 2. BODY (Cuerpo del mensaje)
        if (templateData.message) {
            const bodyComponent = {
                type: 'BODY',
                text: templateData.message
            };

            // Agregar ejemplos de variables si existen
            // Las variables se mapean como: {{1}} = nombre, {{2}} = email, etc.
            // El formato correcto para 360Dialog es: body_text: [['valor1', 'valor2', 'valor3']]
            if (templateData.variableExamples && templateData.variableExamples.length > 0) {
                bodyComponent.example = {
                    body_text: [templateData.variableExamples]  // Array de arrays
                };
            }

            components.push(bodyComponent);
        }

        // 3. FOOTER (Pie de página)
        if (templateData.footer) {
            components.push({
                type: 'FOOTER',
                text: templateData.footer
            });
        }

        // 4. BUTTONS (Botones)
        if (templateData.buttons && templateData.buttons.length > 0) {
            const buttons = [];

            templateData.buttons.forEach((btn, index) => {
                const button = {
                    type: btn.type || 'QUICK_REPLY'
                };

                if (btn.type === 'URL') {
                    button.text = btn.text;
                    button.url = btn.url || '';
                } else if (btn.type === 'PHONE') {
                    button.text = btn.text;
                    button.phone_number = btn.phone || '';
                } else if (btn.type === 'QUICK_REPLY') {
                    button.text = btn.text;
                }

                buttons.push(button);
            });

            if (buttons.length > 0) {
                components.push({
                    type: 'BUTTONS',
                    buttons: buttons
                });
            }
        }

        return {
            name: templateData.name,
            language: templateData.language || 'es',
            category: templateData.category || 'MARKETING',
            components: components,
            variables: templateData.variables || [],  // Guardar mapeo de variables
            variableMapping: templateData.variableMapping || {},  // Mapeo: {{1}} -> 'name', {{2}} -> 'email'
            ...(templateData.businessJustification && {
                business_justification: templateData.businessJustification
            })
        };
    }

    /**
     * Enviar plantilla a 360Dialog
     */
    async sendTemplateToDialog360(templateId, templateData) {
        try {
            logger.info(`📤 Enviando plantilla ${templateId} a 360Dialog`);

            // Enviar a 360Dialog
            const result = await Dialog360Service.submitTemplateForApproval(templateData);

            // Actualizar BD con ID de 360Dialog
            await queryRun(`
                UPDATE template_approvals 
                SET dialog360_id = ?, 
                    dialog360_status = 'PENDING',
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [result.templateId, templateId]);

            logger.info(`✅ Plantilla enviada a 360Dialog: ${result.templateId}`);

            return {
                dialog360Id: result.templateId,
                dialog360Status: result.status
            };
        } catch (error) {
            logger.error(`❌ Error enviando a 360Dialog: ${error.message}`);
            // No lanzar error, solo registrar - la plantilla ya está aprobada localmente
            return {
                dialog360Id: null,
                dialog360Status: 'ERROR',
                error: error.message
            };
        }
    }

    /**
     * Obtener plantilla por ID
     */
    async getTemplate(templateId) {
        try {
            const template = await queryGet(
                'SELECT * FROM template_approvals WHERE id = ?',
                [templateId]
            );

            if (!template) {
                throw new Error('Plantilla no encontrada');
            }

            // Parsear JSON
            if (template.template_data) {
                template.template_data = JSON.parse(template.template_data);
            }

            return template;
        } catch (error) {
            logger.error(`Error obteniendo plantilla: ${error.message}`);
            throw error;
        }
    }

    /**
     * Actualizar estado de plantilla
     */
    async updateTemplateStatus(templateId, status, reason = '') {
        try {
            logger.info(`🔄 Actualizando estado de plantilla ${templateId} a ${status}`);

            await queryRun(`
                UPDATE template_approvals 
                SET status = ?, 
                    rejection_reason = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [status, reason, templateId]);

            logger.info(`✅ Estado actualizado: ${status}`);

            return { success: true };
        } catch (error) {
            logger.error(`Error actualizando estado: ${error.message}`);
            throw error;
        }
    }

    /**
     * Sincronizar estado con 360Dialog
     */
    async syncWithDialog360(templateId) {
        try {
            logger.info(`🔄 Sincronizando plantilla ${templateId} con 360Dialog`);

            // Obtener plantilla
            const template = await this.getTemplate(templateId);

            if (!template.dialog360_id) {
                logger.warn(`⚠️ Plantilla ${templateId} no tiene ID de 360Dialog`);
                return { success: false, message: 'Sin ID de 360Dialog' };
            }

            // Obtener estado de 360Dialog
            const status = await Dialog360Service.getTemplateStatus(template.dialog360_id);

            // Actualizar BD
            await queryRun(`
                UPDATE template_approvals 
                SET dialog360_status = ?, 
                    rejection_reason = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [status.status, status.rejectionReason || null, templateId]);

            logger.info(`✅ Sincronización completada: ${status.status}`);

            return {
                success: true,
                status: status.status,
                rejectionReason: status.rejectionReason
            };
        } catch (error) {
            logger.error(`Error sincronizando: ${error.message}`);
            throw error;
        }
    }

    /**
     * Validar que plantilla esté lista para usar en campaña
     */
    async validateForCampaign(templateId) {
        try {
            const template = await this.getTemplate(templateId);

            // Verificar que esté aprobada localmente
            if (template.status !== 'APPROVED') {
                return {
                    valid: false,
                    message: `Plantilla no aprobada (estado: ${template.status})`
                };
            }

            // Verificar que esté aprobada en 360Dialog
            if (template.dialog360_status && template.dialog360_status !== 'APPROVED') {
                return {
                    valid: false,
                    message: `Plantilla no aprobada en 360Dialog (estado: ${template.dialog360_status})`
                };
            }

            return {
                valid: true,
                message: 'Plantilla lista para usar'
            };
        } catch (error) {
            logger.error(`Error validando plantilla: ${error.message}`);
            return {
                valid: false,
                message: error.message
            };
        }
    }
}

export default new CampaignTemplateService();

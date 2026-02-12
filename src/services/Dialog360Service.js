/**
 * Servicio de Integración con 360Dialog
 * Gestiona la comunicación con la API de 360Dialog para plantillas
 */

import fetch from 'node-fetch';
import { createLogger } from './core/core/logger.js';
import config from '../config/environments/index.js';

const logger = createLogger('DIALOG360_SERVICE');

class Dialog360Service {
    constructor() {
        this.apiKey = config.d360ApiKey;
        this.baseUrl = 'https://waba.360dialog.io/v1';
        this.hubApiBase = 'https://hub.360dialog.io/api/v2';
        
        if (!this.apiKey) {
            logger.warn('⚠️ D360_API_KEY no configurada');
        }
    }

    /**
     * Enviar plantilla a aprobación en 360Dialog
     */
    async submitTemplateForApproval(templateData) {
        try {
            if (!this.apiKey) {
                throw new Error('API Key de 360Dialog no configurada');
            }

            logger.info(`📤 Enviando plantilla "${templateData.name}" a 360Dialog para aprobación`);

            // Construir payload según formato de 360Dialog
            const payload = this.buildTemplatePayload(templateData);

            // Logging detallado del payload
            logger.info(`📋 Payload a enviar:`);
            logger.info(`   Nombre: ${payload.name}`);
            logger.info(`   Idioma: ${payload.language}`);
            logger.info(`   Categoría: ${payload.category}`);
            logger.info(`   Componentes: ${payload.components.length}`);
            
            // Loguear detalles del BODY component
            const bodyComponent = payload.components.find(c => c.type === 'BODY');
            if (bodyComponent) {
                logger.info(`   BODY text: ${bodyComponent.text}`);
                if (bodyComponent.example && bodyComponent.example.body_text) {
                    logger.info(`   BODY example: ${JSON.stringify(bodyComponent.example.body_text)}`);
                }
            }

            const response = await fetch(`${this.baseUrl}/templates`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (!response.ok) {
                logger.error(`❌ Error enviando plantilla: ${data.error?.message || response.statusText}`);
                throw new Error(data.error?.message || `HTTP ${response.status}`);
            }

            logger.info(`✅ Plantilla enviada a 360Dialog: ${data.id}`);

            return {
                success: true,
                templateId: data.id,
                status: data.status,
                message: 'Plantilla enviada a aprobación en 360Dialog'
            };
        } catch (error) {
            logger.error(`❌ Error en submitTemplateForApproval: ${error.message}`);
            throw error;
        }
    }

    /**
     * Obtener estado de plantilla en 360Dialog
     */
    async getTemplateStatus(templateId) {
        try {
            if (!this.apiKey) {
                throw new Error('API Key de 360Dialog no configurada');
            }

            logger.info(`🔍 Obteniendo estado de plantilla: ${templateId}`);

            const response = await fetch(`${this.baseUrl}/templates/${templateId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();

            if (!response.ok) {
                logger.error(`❌ Error obteniendo estado: ${data.error?.message || response.statusText}`);
                throw new Error(data.error?.message || `HTTP ${response.status}`);
            }

            logger.info(`✅ Estado de plantilla: ${data.status}`);

            return {
                success: true,
                templateId: data.id,
                status: data.status,
                rejectionReason: data.rejection_reason || null
            };
        } catch (error) {
            logger.error(`❌ Error en getTemplateStatus: ${error.message}`);
            throw error;
        }
    }

    /**
     * Obtener todas las plantillas
     */
    async getTemplates() {
        try {
            if (!this.apiKey) {
                throw new Error('API Key de 360Dialog no configurada');
            }

            logger.info('📋 Obteniendo lista de plantillas de 360Dialog');

            const response = await fetch(`${this.baseUrl}/templates`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();

            if (!response.ok) {
                logger.error(`❌ Error obteniendo plantillas: ${data.error?.message || response.statusText}`);
                throw new Error(data.error?.message || `HTTP ${response.status}`);
            }

            logger.info(`✅ Se obtuvieron ${data.data?.length || 0} plantillas`);

            return {
                success: true,
                templates: data.data || [],
                count: data.data?.length || 0
            };
        } catch (error) {
            logger.error(`❌ Error en getTemplates: ${error.message}`);
            throw error;
        }
    }

    /**
     * Eliminar plantilla
     */
    async deleteTemplate(templateId) {
        try {
            if (!this.apiKey) {
                throw new Error('API Key de 360Dialog no configurada');
            }

            logger.info(`🗑️ Eliminando plantilla: ${templateId}`);

            const response = await fetch(`${this.baseUrl}/templates/${templateId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                const data = await response.json();
                logger.error(`❌ Error eliminando plantilla: ${data.error?.message || response.statusText}`);
                throw new Error(data.error?.message || `HTTP ${response.status}`);
            }

            logger.info(`✅ Plantilla eliminada: ${templateId}`);

            return {
                success: true,
                message: 'Plantilla eliminada correctamente'
            };
        } catch (error) {
            logger.error(`❌ Error en deleteTemplate: ${error.message}`);
            throw error;
        }
    }

    /**
     * Construir payload de plantilla para 360Dialog
     */
    buildTemplatePayload(templateData) {
        const components = [];

        // Agregar componentes
        if (templateData.components && Array.isArray(templateData.components)) {
            templateData.components.forEach(comp => {
                const component = {
                    type: comp.type
                };

                if (comp.type === 'HEADER') {
                    component.format = comp.format || 'TEXT';
                    if (comp.text) {
                        component.text = comp.text;
                    }
                } else if (comp.type === 'BODY') {
                    component.text = comp.text;
                    
                    // Asegurar que el ejemplo esté en formato correcto
                    // body_text debe ser: [['valor1', 'valor2', 'valor3']]
                    if (comp.example) {
                        if (comp.example.body_text && Array.isArray(comp.example.body_text)) {
                            // Si ya es un array de arrays, usarlo directamente
                            if (Array.isArray(comp.example.body_text[0])) {
                                component.example = comp.example;
                            } else {
                                // Si es un array simple, convertirlo a array de arrays
                                component.example = {
                                    body_text: [comp.example.body_text]
                                };
                            }
                        } else {
                            component.example = comp.example;
                        }
                    }
                } else if (comp.type === 'FOOTER') {
                    component.text = comp.text;
                } else if (comp.type === 'BUTTONS') {
                    component.buttons = comp.buttons || [];
                }

                components.push(component);
            });
        }

        return {
            name: templateData.name,
            language: templateData.language || 'es',
            category: templateData.category || 'MARKETING',
            components: components,
            ...(templateData.businessJustification && {
                business_justification: templateData.businessJustification
            })
        };
    }

    /**
     * Sincronizar plantillas desde 360Dialog
     */
    async syncTemplatesFrom360Dialog() {
        try {
            logger.info('🔄 Sincronizando plantillas desde 360Dialog');

            const result = await this.getTemplates();

            if (result.success) {
                logger.info(`✅ Sincronización completada: ${result.count} plantillas`);
                return result;
            }

            throw new Error('Error en sincronización');
        } catch (error) {
            logger.error(`❌ Error en syncTemplatesFrom360Dialog: ${error.message}`);
            throw error;
        }
    }

    /**
     * Validar que la API Key sea válida
     */
    async validateApiKey() {
        try {
            if (!this.apiKey) {
                return {
                    valid: false,
                    message: 'API Key no configurada'
                };
            }

            logger.info('🔐 Validando API Key de 360Dialog');

            const response = await fetch(`${this.baseUrl}/templates`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                }
            });

            const isValid = response.ok;

            if (isValid) {
                logger.info('✅ API Key válida');
            } else {
                logger.warn('❌ API Key inválida o expirada');
            }

            return {
                valid: isValid,
                message: isValid ? 'API Key válida' : 'API Key inválida o expirada'
            };
        } catch (error) {
            logger.error(`❌ Error validando API Key: ${error.message}`);
            return {
                valid: false,
                message: error.message
            };
        }
    }
}

export default new Dialog360Service();

/**
 * Servicio de Plantillas para 360dialog
 * Especializado en el envío automático de la plantilla "prueba" con formulario
 */

import axios from 'axios';
import { log } from '../../../../src/services/core/core/logger.js';
import { contextManager } from './ContextManager.js';
import {
  validateTemplateName,
  validateTemplateCategory,
  validateTemplateComponent,
  validateTemplateVariables,
  TEMPLATE_LIMITS,
  TEMPLATE_CATEGORIES,
  COMPONENT_TYPES,
} from '../utils/templateValidation.js';

export class TemplateService {
  constructor() {
    this.apiKey = process.env.D360_API_KEY;
    this.apiBase = process.env.WABA_API_BASE || 'https://waba-v2.360dialog.io';
    this.phoneNumberId = process.env.D360_PHONE_NUMBER_ID;
    this.namespace = process.env.D360_NAMESPACE;

    this.headers = {
      'Content-Type': 'application/json',
      'D360-API-KEY': this.apiKey,
    };

    // Configuración de la plantilla "prueba"
    this.templateConfig = {
      name: 'prueba',
      language: 'es',
      components: [
        {
          type: 'body',
          parameters: [
            {
              type: 'text',
              text: '{{1}}', // Nombre del cliente
            },
          ],
        },
      ],
    };
  }

  /**
   * Envía la plantilla "prueba" cuando se detecta intención de compra
   */
  async enviarPlantillaPrueba(phone, nombreCliente = 'Amigo/a') {
    try {
      log(`🎯 Enviando plantilla "prueba" a ${phone}`);

      // Validar nombre de plantilla
      const templateNameValidation = validateTemplateName(
        this.templateConfig.name
      );
      if (!templateNameValidation.isValid) {
        throw new Error(
          `Nombre de plantilla inválido: ${templateNameValidation.error}`
        );
      }

      // Validar categoría de plantilla
      const categoryValidation = validateTemplateCategory('MARKETING');
      if (!categoryValidation.isValid) {
        throw new Error(
          `Categoría de plantilla inválida: ${categoryValidation.error}`
        );
      }

      // Validar variables de plantilla
      const variablesValidation = validateTemplateVariables([nombreCliente]);
      if (!variablesValidation.isValid) {
        throw new Error(
          `Variables de plantilla inválidas: ${variablesValidation.error}`
        );
      }

      // Normalizar número de teléfono
      const normalizedPhone = this.normalizePhone(phone);

      // Preparar el payload para 360dialog
      const payload = {
        messaging_product: 'whatsapp',
        to: normalizedPhone,
        type: 'template',
        template: {
          name: this.templateConfig.name,
          language: {
            code: this.templateConfig.language,
          },
          components: [
            {
              type: 'body',
              parameters: [
                {
                  type: 'text',
                  text: nombreCliente,
                },
              ],
            },
          ],
        },
      };

      // Enviar la plantilla
      const response = await axios.post(`${this.apiBase}/messages`, payload, {
        headers: this.headers,
        timeout: 30000,
      });

      if (
        response.data &&
        response.data.messages &&
        response.data.messages[0]
      ) {
        const messageId = response.data.messages[0].id;

        // Actualizar contexto del cliente
        await contextManager.actualizarEstado(phone, 'enviado_template', {
          templateEnviado: true,
          messageId: messageId,
          timestamp: Date.now(),
        });

        log(
          `✅ Plantilla "prueba" enviada exitosamente a ${phone}. ID: ${messageId}`
        );

        return {
          success: true,
          messageId: messageId,
          templateName: 'prueba',
          timestamp: Date.now(),
        };
      }

      throw new Error('Respuesta inválida de la API');
    } catch (error) {
      log(`❌ Error enviando plantilla "prueba" a ${phone}: ${error.message}`);

      // En caso de error, marcar como fallido pero no bloquear el flujo
      await contextManager.actualizarEstado(phone, 'error_template', {
        error: error.message,
        timestamp: Date.now(),
      });

      return {
        success: false,
        error: error.message,
        templateName: 'prueba',
      };
    }
  }

  /**
   * Lista todas las plantillas disponibles en 360dialog
   */
  async listarPlantillasDisponibles() {
    try {
      log(`🔍 Intentando listar plantillas desde: ${this.apiBase}`);
      log(`🔑 Headers: ${JSON.stringify(this.headers, null, 2)}`);

      // Intentar diferentes endpoints de 360dialog
      const endpoints = [
        '/message_templates',
        '/configs/templates',
        '/v1/configs/templates',
        '/templates',
      ];

      let lastError = null;

      for (const endpoint of endpoints) {
        try {
          log(`🔍 Probando endpoint: ${this.apiBase}${endpoint}`);

          const response = await axios.get(`${this.apiBase}${endpoint}`, {
            headers: this.headers,
            timeout: 10000,
          });

          log(`✅ Respuesta exitosa desde ${endpoint}: ${response.status}`);

          if (response.data) {
            // Manejar diferentes formatos de respuesta
            let templates = [];

            if (response.data.data) {
              templates = response.data.data;
            } else if (response.data.templates) {
              templates = response.data.templates;
            } else if (Array.isArray(response.data)) {
              templates = response.data;
            }

            log(`📋 Encontradas ${templates.length} plantillas en 360dialog`);

            return {
              success: true,
              endpoint: endpoint,
              count: templates.length,
              templates: templates.map(t => ({
                name: t.name,
                status: t.status,
                language: t.language,
                category: t.category,
                id: t.id,
              })),
            };
          }
        } catch (error) {
          lastError = error;
          log(`❌ Error en endpoint ${endpoint}: ${error.message}`);
          continue;
        }
      }

      // Si ningún endpoint funcionó
      return {
        success: false,
        error: `Ningún endpoint funcionó. Último error: ${lastError?.message}`,
        details: lastError?.response?.data || null,
        testedEndpoints: endpoints,
      };
    } catch (error) {
      log(`❌ Error general listando plantillas: ${error.message}`);
      return {
        success: false,
        error: error.message,
        details: error.response?.data || null,
      };
    }
  }

  /**
   * Verifica si la plantilla "prueba" existe y está aprobada
   */
  async verificarPlantillaPrueba() {
    try {
      const response = await axios.get(`${this.apiBase}/message_templates`, {
        headers: this.headers,
        params: {
          name: 'prueba',
        },
      });

      if (response.data && response.data.data) {
        const template = response.data.data.find(t => t.name === 'prueba');

        if (template) {
          log(`✅ Plantilla "prueba" encontrada. Estado: ${template.status}`);
          return {
            exists: true,
            status: template.status,
            approved: template.status === 'APPROVED',
            template: template,
          };
        }
      }

      log('⚠️ Plantilla "prueba" no encontrada');
      return {
        exists: false,
        status: null,
        approved: false,
      };
    } catch (error) {
      log(`❌ Error verificando plantilla "prueba": ${error.message}`);
      return {
        exists: false,
        status: 'ERROR',
        approved: false,
        error: error.message,
      };
    }
  }

  /**
   * Crea la plantilla "prueba" si no existe
   */
  async crearPlantillaPrueba() {
    try {
      // Validar nombre de plantilla
      const templateNameValidation = validateTemplateName('prueba');
      if (!templateNameValidation.isValid) {
        throw new Error(
          `Nombre de plantilla inválido: ${templateNameValidation.error}`
        );
      }

      // Validar categoría de plantilla
      const categoryValidation = validateTemplateCategory('MARKETING');
      if (!categoryValidation.isValid) {
        throw new Error(
          `Categoría de plantilla inválida: ${categoryValidation.error}`
        );
      }

      const templateData = {
        name: 'prueba',
        language: 'es',
        category: 'MARKETING',
        components: [
          {
            type: 'HEADER',
            format: 'TEXT',
            text: '🎉 ¡Participa en nuestro sorteo!',
          },
          {
            type: 'BODY',
            text: 'Hola {{1}}, te invitamos a participar en nuestro increíble sorteo con premio de $4.000.000 💰\n\nPara participar, solo necesitas completar el siguiente formulario con tus datos. ¡Es muy fácil y rápido! 😊',
          },
          {
            type: 'FOOTER',
            text: 'Sorteo oficial - Términos y condiciones aplican',
          },
          {
            type: 'BUTTONS',
            buttons: [
              {
                type: 'FLOW',
                text: '📝 Llenar formulario',
                flow_id: 'FLOW_ID_PLACEHOLDER', // Se debe configurar con el ID real del flow
                flow_token: 'FLOW_TOKEN_PLACEHOLDER',
              },
            ],
          },
        ],
      };

      // Validar cada componente de la plantilla
      for (const component of templateData.components) {
        const componentValidation = validateTemplateComponent(component);
        if (!componentValidation.isValid) {
          throw new Error(
            `Componente de plantilla inválido: ${componentValidation.error}`
          );
        }
      }

      const response = await axios.post(
        `${this.apiBase}/message_templates`,
        templateData,
        { headers: this.headers }
      );

      if (response.data) {
        log('✅ Plantilla "prueba" creada exitosamente');
        return {
          success: true,
          template: response.data,
        };
      }

      throw new Error('Error creando plantilla');
    } catch (error) {
      log(`❌ Error creando plantilla "prueba": ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Normaliza el número de teléfono para 360dialog
   */
  normalizePhone(phone) {
    // Remover espacios y caracteres especiales
    let normalized = phone.replace(/[^\d+]/g, '');

    // Asegurar que empiece con +
    if (!normalized.startsWith('+')) {
      // Asumir código de país Colombia (+57) si no se especifica
      if (normalized.length === 10) {
        normalized = '+57' + normalized;
      } else {
        normalized = '+' + normalized;
      }
    }

    return normalized;
  }

  /**
   * Obtiene estadísticas de envío de plantillas
   */
  async obtenerEstadisticasTemplate() {
    try {
      // Leer todos los contextos para obtener estadísticas
      const contextDir = path.join(process.cwd(), 'data', 'context');
      const files = await fs.readdir(contextDir);

      let totalEnviados = 0;
      let exitosos = 0;
      let fallidos = 0;
      let pendientes = 0;

      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = path.join(contextDir, file);
          const contexto = await fs.readJson(filePath);

          if (contexto.templateEnviado) {
            totalEnviados++;

            switch (contexto.estado) {
              case 'enviado_template':
                exitosos++;
                break;
              case 'error_template':
                fallidos++;
                break;
              case 'completado':
                exitosos++;
                break;
              default:
                pendientes++;
            }
          }
        }
      }

      return {
        totalEnviados,
        exitosos,
        fallidos,
        pendientes,
        tasaExito:
          totalEnviados > 0 ? ((exitosos / totalEnviados) * 100).toFixed(2) : 0,
      };
    } catch (error) {
      log(`❌ Error obteniendo estadísticas de template: ${error.message}`);
      return {
        totalEnviados: 0,
        exitosos: 0,
        fallidos: 0,
        pendientes: 0,
        tasaExito: 0,
      };
    }
  }

  /**
   * Programa el envío de un template con delay
   */
  async programarEnvioTemplate(phone, nombreCliente, delayMinutos = 0) {
    if (delayMinutos === 0) {
      return await this.enviarPlantillaPrueba(phone, nombreCliente);
    }

    setTimeout(
      async () => {
        await this.enviarPlantillaPrueba(phone, nombreCliente);
      },
      delayMinutos * 60 * 1000
    );

    log(`⏰ Template programado para ${phone} en ${delayMinutos} minutos`);

    return {
      success: true,
      scheduled: true,
      delayMinutos: delayMinutos,
      executeAt: new Date(Date.now() + delayMinutos * 60 * 1000),
    };
  }

  /**
   * Valida si se puede enviar template a un número
   */
  async puedeEnviarTemplate(phone) {
    try {
      const contexto = await contextManager.cargarContexto(phone);

      // No enviar si ya se envió en las últimas 24 horas
      if (contexto.templateEnviado) {
        const ultimoEnvio = contexto.ultimaActualizacion;
        const hace24Horas = Date.now() - 24 * 60 * 60 * 1000;

        if (ultimoEnvio > hace24Horas) {
          return {
            puede: false,
            razon: 'Template ya enviado en las últimas 24 horas',
          };
        }
      }

      // No enviar si el cliente rechazó
      if (contexto.estado === 'rechazado') {
        return {
          puede: false,
          razon: 'Cliente rechazó anteriormente',
        };
      }

      // No enviar si ya completó el proceso
      if (contexto.estado === 'completado') {
        return {
          puede: false,
          razon: 'Cliente ya completó el proceso',
        };
      }

      return {
        puede: true,
        razon: 'Apto para recibir template',
      };
    } catch (error) {
      log(
        `❌ Error validando envío de template para ${phone}: ${error.message}`
      );
      return {
        puede: false,
        razon: 'Error en validación',
      };
    }
  }
}

// Instancia singleton
export const templateService = new TemplateService();

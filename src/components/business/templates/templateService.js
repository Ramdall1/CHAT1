
/**
 * Template Service
 *
 * Encapsula la lógica de negocio para la gestión de plantillas.
 * Se comunica con el gestor de plantillas, servicios de IA y APIs externas.
 */
// import templateManager from './template_manager.js'; // TODO: Crear este archivo
// import { generateAITemplate } from './ai_template_generator.js'; // TODO: Crear este archivo
// Asumimos que hay un logger estandarizado
import logger from '../../../apps/api/src/utils/helpers/helpers/logger.js';
// Funciones de API que estaban en server.js
import { listTemplates as listWabaTemplates, sendTemplate } from './wabaHelpers.js';

// TODO: Mover la lógica de axios a un cliente de API dedicado.
import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const CONFIG = {
  WABA_API_BASE: process.env.WABA_API_BASE || 'https://waba-v2.360dialog.io',
  D360_API_KEY: process.env.D360_API_KEY
};

const headers = {
  'Content-Type': 'application/json',
  'D360-API-KEY': CONFIG.D360_API_KEY
};

export const templateService = {
  async listTemplates(includeAllDetails = false) {
    logger.info('Servicio: listTemplates invocado');
    // TODO: Implementar cuando templateManager esté disponible
    throw new Error('templateManager no está disponible - pendiente de implementación');
  },

  async getTemplateByName(name) {
    logger.info(`Servicio: getTemplateByName para ${name}`);
    // TODO: Implementar cuando templateManager esté disponible
    throw new Error('templateManager no está disponible - pendiente de implementación');
  },

  async generateTemplateWithAI(prompt) {
    logger.info('Servicio: generateTemplateWithAI invocado');
    if (!prompt) {
      throw new Error('Se requiere un prompt para la generación con IA');
    }
    // TODO: Implementar cuando generateAITemplate esté disponible
    throw new Error('generateAITemplate no está disponible - pendiente de implementación');
  },

  async getTemplatePreview(templateName, parameters) {
    logger.info(`Servicio: getTemplatePreview para ${templateName}`);
    if (!templateName) {
      throw new Error('Falta el nombre de la plantilla');
    }
    // TODO: Implementar cuando templateManager esté disponible
    throw new Error('templateManager no está disponible - pendiente de implementación');
  },

  createTemplateBase(templateData) {
    logger.info(`Servicio: createTemplateBase para ${templateData.name}`);
    const { name, language, category, components } = templateData;
    if (!name || !language || !components) {
      throw new Error('Faltan parámetros obligatorios (name, language, components)');
    }
    return {
      name,
      language,
      category: category || 'MARKETING',
      components: components || []
    };
  },

  async uploadTemplateTo360(templateData) {
    logger.info(`Servicio: uploadTemplateTo360 para ${templateData.name}`);
    if (!templateData.name || !templateData.language || !templateData.components) {
      throw new Error('La plantilla no tiene la estructura correcta');
    }
    // Lógica de simulación que estaba en server.js
    logger.info('📤 Simulando envío de plantilla a 360dialog:', templateData.name);
    return { 
      success: true, 
      message: 'Plantilla enviada para revisión (simulado)',
      template: templateData
    };
  },
  
  async getWabaTemplates() {
    logger.info('Servicio: getWabaTemplates invocado');
    return listWabaTemplates();
  },

  async getTemplateStructure(name, lang) {
    logger.info(`Servicio: getTemplateStructure para ${name}`);
    if (!name) throw new Error('name requerido');
    
    const all = await this.getWabaTemplates();
    const tpl = all.find(t => t.name === name && (!lang || t.language === lang)) || all.find(t => t.name === name);
    if (!tpl) throw new Error('Plantilla no encontrada');

    const comps = tpl.components || [];
    const header = comps.find(c => (c.type || '').toUpperCase() === 'HEADER');
    const body = comps.find(c => (c.type || '').toUpperCase() === 'BODY');
    const buttons = comps.filter(c => (c.type || '').toUpperCase() === 'BUTTONS');

    const headerFmt = header ? (header.format || '').toUpperCase() : null;
    const headerSample = header ? (header.text || header.example?.header_text?.[0] || '') : '';
    const headerNeedsVar = header ? /\{\{d\}\}/.test(String(headerSample)) : false;
    const bodySample = body ? (body.text || body.example?.body_text?.[0] || '') : '';
    const bodyMatches = String(bodySample).match(/\{\{d\}\}/g);
    const bodyVars = bodyMatches ? new Set(bodyMatches).size : 0;
    const buttonDefs = (buttons[0]?.buttons || []).map((b,i) => ({
      index: i,
      type: (b.type || '').toUpperCase()
    }));

    return {
      name: tpl.name,
      language: tpl.language,
      category: tpl.category || null,
      header: header ? { format: headerFmt, needsVar: headerNeedsVar } : null,
      body: { variables: bodyVars },
      buttons: buttonDefs
    };
  },

  async sendTemplateMessage(payload) {
    logger.info(`Servicio: sendTemplateMessage para ${payload.to}`);
    // Aquí la lógica de construcción del payload y envío que estaba en /api/send-template
    // Por simplicidad, llamaremos a la función helper que crearemos.
    return sendTemplate(payload);
  }
};

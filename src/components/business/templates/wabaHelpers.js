
/**
 * WABA Helpers
 *
 * Funciones de ayuda para interactuar con la API de 360dialog (WABA).
 * Estas funciones estaban originalmente en server.js.
 */
import axios from 'axios';
import dotenv from 'dotenv';
import logger from '../../../apps/api/src/utils/helpers/helpers/logger.js';

dotenv.config();

const CONFIG = {
  WABA_API_BASE: process.env.WABA_API_BASE || 'https://waba-v2.360dialog.io',
  D360_API_KEY: process.env.D360_API_KEY
};

const headers = {
  'Content-Type': 'application/json',
  'D360-API-KEY': CONFIG.D360_API_KEY
};

function normalizeLang(code) {
  if (!code) return 'es';
  return code;
}

export async function listTemplates() {
  try {
    const r = await axios.get(`${CONFIG.WABA_API_BASE}/v1/configs/templates`, { headers });
    const all = r.data?.waba_templates || [];
    return all
      .filter(t => (t.status || '').toLowerCase() === 'approved')
      .map(t => ({
        name: t.name,
        language: t.language,
        status: t.status,
        category: t.category || null,
        components: t.components || []
      }));
  } catch (error) {
    logger.error('Error fetching WABA templates:', error.message);
    throw error;
  }
}

export async function sendTemplate({ to, name, languageCode, components }) {
  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'template',
    template: {
      name,
      language: { code: normalizeLang(languageCode || 'es') }
    }
  };
  if (components && components.length) {
    payload.template.components = components;
  }

  try {
    const r = await axios.post(`${CONFIG.WABA_API_BASE}/messages`, payload, { headers });
    logger.info(`📋 Plantilla '${name}' enviada a ${to}`);
    return r.data;
  } catch (e) {
    const detail = e.response?.data || e.message;
    logger.error('❌ Error enviando plantilla:', detail);
    throw { status: e.response?.status || 500, detail };
  }
}

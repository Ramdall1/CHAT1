import dotenv from 'dotenv';
import path from 'path';
import axios from 'axios';

dotenv.config();

export const CONFIG = {
  // ===== Configuración del servidor =====
  PORT: process.env.PORT || 3000,

  // ===== 360dialog API Configuration =====
  D360_API_KEY: process.env.D360_API_KEY,
  WABA_API_BASE: process.env.WABA_API_BASE || 'https://waba-v2.360dialog.io',

  // ===== Configuración eliminada - Proyecto migrado completamente a 360dialog =====

  // ===== AI Configuration =====
  AI_ENDPOINT:
    process.env.AI_ENDPOINT || 'https://api.openai.com/v1/chat/completions',
  AI_MODEL: process.env.AI_MODEL || 'gpt-3.5-turbo',
  AI_API_KEY: process.env.AI_API_KEY || '',

  // ===== Webhook Configuration =====
  NGROK_URL: process.env.NGROK_URL || '',

  // ===== Configuración adicional =====
  REJECT_CALL_MESSAGE:
    process.env.REJECT_CALL_MESSAGE ||
    'No puedo atender ahora, te devuelvo la llamada en breve.',
  DEFAULT_PRODUCT_ID: process.env.DEFAULT_PRODUCT_ID || '',

  // ===== ManyChat Config =====
  MANYCHAT_API_KEY: process.env.MANYCHAT_API_KEY || '',
  MANYCHAT_API_BASE:
    process.env.MANYCHAT_API_BASE || 'https://api.manychat.com',
  MANYCHAT_PHONE_FIELD: process.env.MANYCHAT_PHONE_FIELD || 'whatsapp_phone',

  // ===== 360dialog Account Details =====
  D360_PARTNER_ID: process.env.D360_PARTNER_ID || '',
  D360_WABA_ACCOUNT_ID: process.env.D360_WABA_ACCOUNT_ID || '',
  D360_WHATSAPP_CHANNEL_ID: process.env.D360_WHATSAPP_CHANNEL_ID || '',
  D360_WABA_CHANNEL_EXTERNAL_ID:
    process.env.D360_WABA_CHANNEL_EXTERNAL_ID || '',
  D360_PHONE_NUMBER_ID: process.env.D360_PHONE_NUMBER_ID || '',
  D360_NAMESPACE: process.env.D360_NAMESPACE || '',
  D360_TIMEZONE_ID: process.env.D360_TIMEZONE_ID || '',
  D360_FB_BUSINESS_MANAGER_ID: process.env.D360_FB_BUSINESS_MANAGER_ID || '',
  D360_WABA_BUSINESS_ACCOUNT_ID:
    process.env.D360_WABA_BUSINESS_ACCOUNT_ID || '',
};

// Headers estándar para 360dialog API
export const headers = {
  'Content-Type': 'application/json',
  'D360-API-KEY': CONFIG.D360_API_KEY,
};

// Headers para Hub 360dialog (mantiene compatibilidad)
export const hubHeaders = {
  'Content-Type': 'application/json',
  'X-API-KEY': CONFIG.D360_API_KEY,
};

export const mcHeaders = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${CONFIG.MANYCHAT_API_KEY}`,
};

// Utilidades
export function e164(phone) {
  const p = String(phone || '').trim();
  return p.startsWith('+') ? p : '+' + p;
}

export function normalizeLang(code) {
  // Usar exactamente el code si viene del listado; evitar generar códigos inválidos como en_ES
  if (!code) return 'es'; // por defecto español genérico
  return code; // no forzar sufijos regionales
}

// ===== Helpers para WhatsApp =====
export async function sendWhatsAppText(to, text) {
  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'text',
    text: { body: String(text) },
  };
  try {
    const r = await axios.post(`${CONFIG.WABA_API_BASE}/messages`, payload, {
      headers,
    });
    console.log(`✅ Texto enviado a ${to}`);
    return r.data;
  } catch (e) {
    const detail = e.response?.data || e.message;
    console.log('❌ Error enviando mensaje:', detail);
    throw e;
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
      language: { code: normalizeLang(languageCode || 'es') },
    },
  };
  if (components && components.length) payload.template.components = components;
  try {
    const r = await axios.post(`${CONFIG.WABA_API_BASE}/messages`, payload, {
      headers,
    });
    console.log(`📋 Plantilla '${name}' enviada a ${to}`);
    return r.data;
  } catch (e) {
    const detail = e.response?.data || e.message;
    console.log('❌ Error enviando plantilla:', detail);
    throw { status: e.response?.status || 500, detail };
  }
}

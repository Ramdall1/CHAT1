/**
 * @fileoverview Configuración centralizada del servidor
 * Extraída de server.js para mejorar la modularidad
 */

import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

/**
 * Configuración principal del servidor
 */
export const SERVER_CONFIG = {
  // Configuración del servidor
  PORT: process.env.PORT || 3000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  
  // Configuración de 360Dialog
  D360_API_KEY: process.env.D360_API_KEY,
  WABA_API_BASE: process.env.WABA_API_BASE || 'https://waba-v2.360dialog.io',
  D360_PARTNER_ID: process.env.D360_PARTNER_ID || '',
  D360_WABA_ACCOUNT_ID: process.env.D360_WABA_ACCOUNT_ID || '',
  D360_WHATSAPP_CHANNEL_ID: process.env.D360_WHATSAPP_CHANNEL_ID || '',
  D360_WABA_CHANNEL_EXTERNAL_ID: process.env.D360_WABA_CHANNEL_EXTERNAL_ID || '',
  D360_PHONE_NUMBER_ID: process.env.D360_PHONE_NUMBER_ID || '',
  D360_NAMESPACE: process.env.D360_NAMESPACE || '',
  D360_TIMEZONE_ID: process.env.D360_TIMEZONE_ID || '',
  D360_FB_BUSINESS_MANAGER_ID: process.env.D360_FB_BUSINESS_MANAGER_ID || '',
  D360_WABA_BUSINESS_ACCOUNT_ID: process.env.D360_WABA_BUSINESS_ACCOUNT_ID || '',
  
  // Configuración de IA
  AI_ENDPOINT: process.env.AI_ENDPOINT || '',
  AI_MODEL: process.env.AI_MODEL || '',
  
  // Configuración de Ngrok
  NGROK_URL: process.env.NGROK_URL || '',
  
  // Configuración de mensajes
  REJECT_CALL_MESSAGE: process.env.REJECT_CALL_MESSAGE || 'No puedo atender ahora, te devuelvo la llamada en breve.',
  DEFAULT_PRODUCT_ID: process.env.DEFAULT_PRODUCT_ID || '',
  
  // Configuración de JWT
  JWT_SECRET: process.env.JWT_SECRET || 'Kx9#mP2$vL8@nQ5!wR7&tY4^uI6*oE3%aS1+dF0-gH9=jK2#'
};

/**
 * Headers para 360Dialog API
 */
export const API_HEADERS = {
  'Content-Type': 'application/json',
  'D360-API-KEY': SERVER_CONFIG.D360_API_KEY
};

/**
 * Headers para Hub API
 */
export const HUB_HEADERS = {
  'Content-Type': 'application/json',
  'X-API-KEY': SERVER_CONFIG.D360_API_KEY
};

/**
 * Configuración de directorios
 */
export const DIRECTORIES = {
  DATA_DIR: path.join(process.cwd(), 'data'),
  UPLOADS_DIR: path.join(process.cwd(), 'public', 'uploads'),
  PUBLIC_DIR: path.join(process.cwd(), 'public'),
  CLIENT_DIR: path.join(process.cwd(), 'client')
};

/**
 * Configuración de archivos
 */
export const FILES = {
  PROCESSED_IDS: path.join(DIRECTORIES.DATA_DIR, 'processed_ids.json'),
  TEMPLATE_LOG: path.join(DIRECTORIES.DATA_DIR, 'template_log.json'),
  CONTACTS_LOG: path.join(DIRECTORIES.DATA_DIR, 'contacts_log.json')
};

/**
 * Configuración de seguridad
 */
export const SECURITY_CONFIG = {
  rateLimitConfig: {
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 100, // máximo 100 requests por ventana
    message: 'Demasiadas solicitudes desde esta IP, intenta de nuevo más tarde.'
  },
  enableSanitization: true,
  enableValidation: true,
  enableThreatDetection: true,
  logLevel: 'info'
};

/**
 * Configuración de compresión
 */
export const COMPRESSION_CONFIG = {
  level: 6, // Nivel de compresión (1-9, 6 es un buen balance)
  threshold: 1024, // Solo comprimir respuestas mayores a 1KB
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return true;
  }
};

/**
 * Configuración de paginación
 */
export const PAGINATION_CONFIG = {
  defaultLimit: 20,
  maxLimit: 100,
  defaultSort: { timestamp: -1 },
  enableCache: true
};

/**
 * Configuración de multer
 */
export const MULTER_CONFIG = {
  limits: {
    fileSize: 16 * 1024 * 1024 // 16MB límite
  },
  fileFilter: function(req, file, cb) {
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'audio/mpeg', 'audio/wav', 'audio/ogg',
      'video/mp4', 'video/avi', 'video/mov',
      'application/pdf', 'application/msword'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de archivo no permitido'));
    }
  }
};

export default {
  SERVER_CONFIG,
  API_HEADERS,
  HUB_HEADERS,
  DIRECTORIES,
  FILES,
  SECURITY_CONFIG,
  COMPRESSION_CONFIG,
  PAGINATION_CONFIG,
  MULTER_CONFIG
};
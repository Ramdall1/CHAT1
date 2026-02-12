/**
 * Gestor de Media (Imágenes, Videos, Documentos)
 * Integración con 360Dialog
 * Descarga y almacena media por contacto
 */

import fs from 'fs/promises';
import path from 'path';
import axios from 'axios';
import sqlite3 from 'sqlite3';
import { createLogger } from './core/core/logger.js';

const logger = createLogger('MEDIA_MANAGER');

const DB_PATH = path.join(process.cwd(), 'data', 'database.sqlite');
const UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads');

class MediaManager {
  constructor() {
    this.dialog360ApiKey = process.env.D360_API_KEY;
    this.dialog360BaseUrl = process.env.D360_API_BASE || 'https://waba-v2.360dialog.io';
    this.initialized = false;
  }

  /**
   * Inicializar directorios
   */
  async initialize() {
    try {
      // Crear directorio base de uploads
      await fs.mkdir(UPLOADS_DIR, { recursive: true });

      // Crear subdirectorios por tipo
      const types = ['images', 'videos', 'documents', 'audio'];
      for (const type of types) {
        const typeDir = path.join(UPLOADS_DIR, type);
        await fs.mkdir(typeDir, { recursive: true });
      }

      this.initialized = true;
      logger.info('✅ MediaManager inicializado correctamente');
    } catch (error) {
      logger.error('❌ Error inicializando MediaManager:', error);
    }
  }

  /**
   * Descargar media desde 360Dialog
   */
  async downloadMediaFrom360Dialog(mediaId, mediaType, phone, contactId) {
    try {
      logger.info(`📥 Descargando ${mediaType} desde 360Dialog: ${mediaId}`);

      // Obtener URL del media desde 360Dialog
      const mediaUrl = await this.getMediaUrlFrom360Dialog(mediaId);

      if (!mediaUrl) {
        throw new Error('No se pudo obtener URL del media');
      }

      // Descargar el archivo
      const filePath = await this.downloadFile(mediaUrl, mediaType, phone);

      // Guardar en BD
      await this.saveMediaToDB(contactId, phone, mediaId, mediaType, filePath);

      logger.info(`✅ Media descargado correctamente: ${filePath}`);

      return {
        success: true,
        filePath,
        mediaUrl: `/uploads/${mediaType}/${path.basename(filePath)}`
      };
    } catch (error) {
      logger.error(`❌ Error descargando media: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Obtener URL del media desde 360Dialog
   */
  async getMediaUrlFrom360Dialog(mediaId) {
    try {
      const response = await axios.get(
        `${this.dialog360BaseUrl}/media/${mediaId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.dialog360ApiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data?.url || null;
    } catch (error) {
      logger.error(`❌ Error obteniendo URL de 360Dialog: ${error.message}`);
      return null;
    }
  }

  /**
   * Descargar archivo desde URL
   */
  async downloadFile(url, mediaType, phone) {
    try {
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        headers: {
          'Authorization': `Bearer ${this.dialog360ApiKey}`
        }
      });

      // Generar nombre de archivo
      const fileName = `${phone}_${Date.now()}_${this.generateRandomString(8)}`;
      const extension = this.getExtensionFromContentType(response.headers['content-type']);
      const fullFileName = `${fileName}${extension}`;

      // Determinar carpeta según tipo
      const typeFolder = this.getTypeFolder(mediaType);
      const filePath = path.join(UPLOADS_DIR, typeFolder, fullFileName);

      // Guardar archivo
      await fs.writeFile(filePath, response.data);

      logger.info(`✅ Archivo descargado: ${fullFileName}`);

      return filePath;
    } catch (error) {
      logger.error(`❌ Error descargando archivo: ${error.message}`);
      throw error;
    }
  }

  /**
   * Guardar media en BD
   */
  async saveMediaToDB(contactId, phone, mediaId, mediaType, filePath) {
    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(DB_PATH);

      const relativePath = filePath.replace(process.cwd() + '/public', '');
      const fileSize = require('fs').statSync(filePath).size;

      db.run(
        `INSERT INTO media (contact_id, phone, media_id, type, file_path, file_size, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [contactId, phone, mediaId, mediaType, relativePath, fileSize, new Date().toISOString()],
        (err) => {
          if (err) {
            logger.error(`❌ Error guardando media en BD: ${err.message}`);
            reject(err);
          } else {
            logger.info(`✅ Media guardado en BD: ${mediaId}`);
            resolve();
          }
          db.close();
        }
      );
    });
  }

  /**
   * Obtener media por contacto
   */
  async getMediaByContact(contactId) {
    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(DB_PATH);

      db.all(
        `SELECT * FROM media WHERE contact_id = ? ORDER BY created_at DESC`,
        [contactId],
        (err, rows) => {
          if (err) {
            logger.error(`❌ Error obteniendo media: ${err.message}`);
            reject(err);
          } else {
            resolve(rows || []);
          }
          db.close();
        }
      );
    });
  }

  /**
   * Obtener media por teléfono
   */
  async getMediaByPhone(phone) {
    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(DB_PATH);

      db.all(
        `SELECT * FROM media WHERE phone_number = ? ORDER BY created_at DESC`,
        [phone],
        (err, rows) => {
          if (err) {
            logger.error(`❌ Error obteniendo media: ${err.message}`);
            reject(err);
          } else {
            resolve(rows || []);
          }
          db.close();
        }
      );
    });
  }

  /**
   * Obtener media por tipo
   */
  async getMediaByType(contactId, mediaType) {
    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(DB_PATH);

      db.all(
        `SELECT * FROM media WHERE contact_id = ? AND type = ? ORDER BY created_at DESC`,
        [contactId, mediaType],
        (err, rows) => {
          if (err) {
            logger.error(`❌ Error obteniendo media: ${err.message}`);
            reject(err);
          } else {
            resolve(rows || []);
          }
          db.close();
        }
      );
    });
  }

  /**
   * Subir media a 360Dialog
   */
  async uploadMediaTo360Dialog(filePath, mediaType) {
    try {
      const fileContent = await fs.readFile(filePath);
      const fileName = path.basename(filePath);

      const formData = new FormData();
      const blob = new Blob([fileContent], { type: this.getContentType(mediaType) });
      formData.append('file', blob, fileName);
      formData.append('type', mediaType);

      const response = await axios.post(
        `${this.dialog360BaseUrl}/media`,
        formData,
        {
          headers: {
            'Authorization': `Bearer ${this.dialog360ApiKey}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      logger.info(`✅ Media subido a 360Dialog: ${response.data?.media_id}`);

      return {
        success: true,
        mediaId: response.data?.media_id,
        mediaUrl: response.data?.url
      };
    } catch (error) {
      logger.error(`❌ Error subiendo media a 360Dialog: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Enviar media a contacto
   */
  async sendMediaToContact(phone, mediaId, mediaType, caption = '') {
    try {
      const payload = {
        messaging_product: 'whatsapp',
        to: phone,
        type: mediaType,
        [mediaType]: {
          id: mediaId,
          ...(caption && { caption })
        }
      };

      const response = await axios.post(
        `${this.dialog360BaseUrl}/messages`,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${this.dialog360ApiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      logger.info(`✅ Media enviado a ${phone}: ${response.data?.messages?.[0]?.id}`);

      return {
        success: true,
        messageId: response.data?.messages?.[0]?.id
      };
    } catch (error) {
      logger.error(`❌ Error enviando media: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Obtener carpeta según tipo
   */
  getTypeFolder(mediaType) {
    const typeMap = {
      'image': 'images',
      'video': 'videos',
      'document': 'documents',
      'audio': 'audio'
    };
    return typeMap[mediaType] || 'files';
  }

  /**
   * Obtener extensión desde content-type
   */
  getExtensionFromContentType(contentType) {
    const extensionMap = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp',
      'video/mp4': '.mp4',
      'video/webm': '.webm',
      'application/pdf': '.pdf',
      'application/msword': '.doc',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
      'audio/mpeg': '.mp3',
      'audio/ogg': '.ogg'
    };
    return extensionMap[contentType] || '.bin';
  }

  /**
   * Obtener content-type
   */
  getContentType(mediaType) {
    const typeMap = {
      'image': 'image/jpeg',
      'video': 'video/mp4',
      'document': 'application/pdf',
      'audio': 'audio/mpeg'
    };
    return typeMap[mediaType] || 'application/octet-stream';
  }

  /**
   * Generar string aleatorio
   */
  generateRandomString(length) {
    return Math.random().toString(36).substring(2, 2 + length);
  }

  /**
   * Limpiar media antiguo
   */
  async cleanOldMedia(daysToKeep = 30) {
    try {
      const now = Date.now();
      const maxAge = daysToKeep * 24 * 60 * 60 * 1000;

      const types = ['images', 'videos', 'documents', 'audio'];
      for (const type of types) {
        const typeDir = path.join(UPLOADS_DIR, type);
        const files = await fs.readdir(typeDir);

        for (const file of files) {
          const filePath = path.join(typeDir, file);
          const stats = await fs.stat(filePath);

          if (now - stats.mtimeMs > maxAge) {
            await fs.unlink(filePath);
            logger.info(`🗑️  Media antiguo eliminado: ${file}`);
          }
        }
      }
    } catch (error) {
      logger.error(`❌ Error limpiando media antiguo: ${error.message}`);
    }
  }

  /**
   * Obtener estadísticas de media
   */
  async getStats() {
    try {
      const stats = {};
      const types = ['images', 'videos', 'documents', 'audio'];

      for (const type of types) {
        const typeDir = path.join(UPLOADS_DIR, type);
        const files = await fs.readdir(typeDir);
        stats[type] = files.length;
      }

      return { success: true, stats };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

// Crear instancia global
const mediaManager = new MediaManager();
await mediaManager.initialize();

export default mediaManager;

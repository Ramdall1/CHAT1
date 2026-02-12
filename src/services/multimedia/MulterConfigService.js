/**
 * @fileoverview Servicio de configuración de Multer
 * Extraído de multimedia.js para mejorar la modularidad
 */

import multer from 'multer';
import path from 'path';
import fs from 'fs-extra';
import crypto from 'crypto';
import { createLogger } from '../core/core/logger.js';

const logger = createLogger('MULTER_CONFIG_SERVICE');

/**
 * @class MulterConfigService
 * Servicio para configurar diferentes tipos de almacenamiento con Multer
 */
export class MulterConfigService {
  constructor() {
    this.logger = logger;
  }

  /**
   * Crear configuración de almacenamiento por tipo
   */
  createStorage(type) {
    return multer.diskStorage({
      destination: function(req, file, cb) {
        const uploadDir = path.join(process.cwd(), 'public', 'uploads', type);
        fs.ensureDirSync(uploadDir);
        cb(null, uploadDir);
      },
      filename: function(req, file, cb) {
        const hash = crypto.randomBytes(16).toString('hex');
        const ext = path.extname(file.originalname);
        const timestamp = Date.now();
        cb(null, `${type}_${timestamp}_${hash}${ext}`);
      }
    });
  }

  /**
   * Configuración para imágenes
   */
  getImageUploadConfig() {
    return {
      storage: this.createStorage('images'),
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
      fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (allowedTypes.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new Error('Tipo de imagen no permitido. Solo JPEG, PNG, GIF y WebP.'));
        }
      }
    };
  }

  /**
   * Configuración para videos
   */
  getVideoUploadConfig() {
    return {
      storage: this.createStorage('videos'),
      limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
      fileFilter: (req, file, cb) => {
        const allowedTypes = ['video/mp4', 'video/avi', 'video/mov', 'video/wmv'];
        if (allowedTypes.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new Error('Tipo de video no permitido. Solo MP4, AVI, MOV y WMV.'));
        }
      }
    };
  }

  /**
   * Configuración para audio
   */
  getAudioUploadConfig() {
    return {
      storage: this.createStorage('audio'),
      limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
      fileFilter: (req, file, cb) => {
        const allowedTypes = ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp3'];
        if (allowedTypes.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new Error('Tipo de audio no permitido. Solo MP3, WAV y OGG.'));
        }
      }
    };
  }

  /**
   * Configuración para documentos
   */
  getDocumentUploadConfig() {
    return {
      storage: this.createStorage('documents'),
      limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
      fileFilter: (req, file, cb) => {
        const allowedTypes = [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'text/plain'
        ];
        if (allowedTypes.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new Error('Tipo de documento no permitido.'));
        }
      }
    };
  }

  /**
   * Crear instancia de multer para tipo específico
   */
  createMulterInstance(type) {
    let config;
    
    switch (type) {
      case 'image':
        config = this.getImageUploadConfig();
        break;
      case 'video':
        config = this.getVideoUploadConfig();
        break;
      case 'audio':
        config = this.getAudioUploadConfig();
        break;
      case 'document':
        config = this.getDocumentUploadConfig();
        break;
      default:
        throw new Error(`Tipo de archivo no soportado: ${type}`);
    }

    return multer(config);
  }

  /**
   * Obtener todas las configuraciones
   */
  getAllConfigs() {
    return {
      image: this.createMulterInstance('image'),
      video: this.createMulterInstance('video'),
      audio: this.createMulterInstance('audio'),
      document: this.createMulterInstance('document')
    };
  }
}

export default MulterConfigService;
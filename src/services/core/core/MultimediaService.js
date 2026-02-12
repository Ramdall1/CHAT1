import fs from 'fs-extra';
import path from 'path';
import crypto from 'crypto';
import sharp from 'sharp';
import ffmpeg from 'fluent-ffmpeg';
import mime from 'mime-types';
import { createLogger } from './logger.js';

class MultimediaService {
  constructor() {
    this.uploadsDir = path.join(process.cwd(), 'public', 'uploads');
    this.maxSizes = {
      images: 10 * 1024 * 1024,    // 10MB
      videos: 100 * 1024 * 1024,   // 100MB
      audio: 50 * 1024 * 1024,     // 50MB
      documents: 25 * 1024 * 1024  // 25MB
    };
        
    this.allowedTypes = {
      images: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
      videos: ['video/mp4', 'video/avi', 'video/mov', 'video/wmv'],
      audio: ['audio/mp3', 'audio/wav', 'audio/ogg', 'audio/m4a'],
      documents: [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'text/plain'
      ]
    };

    // Logger centralizado
    this.logger = createLogger('MULTIMEDIA_SERVICE');

    this.initializeDirectories();
  }

  /**
     * Inicializar directorios de almacenamiento
     */
  async initializeDirectories() {
    try {
      await fs.ensureDir(this.uploadsDir);
            
      for (const type of Object.keys(this.allowedTypes)) {
        const typeDir = path.join(this.uploadsDir, type);
        await fs.ensureDir(typeDir);
      }
    } catch (error) {
      if (this.logger) this.logger.error('Error inicializando directorios multimedia:', error);
    }
  }

  /**
     * Validar archivo antes del procesamiento
     */
  validateFile(file, type) {
    const errors = [];

    // Validar tipo de archivo
    if (!this.allowedTypes[type]) {
      errors.push(`Tipo de archivo no soportado: ${type}`);
      return { valid: false, errors };
    }

    // Validar MIME type
    if (!this.allowedTypes[type].includes(file.mimetype)) {
      errors.push(`Tipo MIME no permitido: ${file.mimetype}`);
    }

    // Validar tamaño
    if (file.size > this.maxSizes[type]) {
      const maxSizeMB = this.maxSizes[type] / (1024 * 1024);
      errors.push(`Archivo demasiado grande. Máximo: ${maxSizeMB}MB`);
    }

    // Validar extensión vs MIME type
    const expectedMime = mime.lookup(file.originalname);
    if (expectedMime && expectedMime !== file.mimetype) {
      errors.push('Extensión de archivo no coincide con el tipo MIME');
    }

    // Validar nombre de archivo
    if (!/^[a-zA-Z0-9._-]+$/.test(file.originalname)) {
      errors.push('Nombre de archivo contiene caracteres no permitidos');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
     * Generar nombre único para archivo
     */
  generateUniqueFilename(originalName, type) {
    const hash = crypto.randomBytes(16).toString('hex');
    const timestamp = Date.now();
    const ext = path.extname(originalName);
    return `${type}_${timestamp}_${hash}${ext}`;
  }

  /**
     * Obtener información de archivo
     */
  async getFileInfo(filePath) {
    try {
      const stats = await fs.stat(filePath);
      const mimeType = mime.lookup(filePath);
            
      return {
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
        mimetype: mimeType,
        exists: true
      };
    } catch (error) {
      return { exists: false, error: error.message };
    }
  }

  /**
     * Procesar imagen con opciones avanzadas
     */
  async processImage(inputPath, options = {}) {
    const {
      width = null,
      height = null,
      quality = 80,
      format = 'jpeg',
      compress = true,
      watermark = null,
      blur = null,
      sharpen = false
    } = options;

    try {
      const outputPath = inputPath.replace(
        path.extname(inputPath), 
        `_processed.${format}`
      );
            
      let sharpInstance = sharp(inputPath);
            
      // Redimensionar
      if (width || height) {
        sharpInstance = sharpInstance.resize(width, height, {
          fit: 'inside',
          withoutEnlargement: true
        });
      }
            
      // Aplicar efectos
      if (blur) {
        sharpInstance = sharpInstance.blur(parseFloat(blur));
      }
            
      if (sharpen) {
        sharpInstance = sharpInstance.sharpen();
      }
            
      // Agregar marca de agua
      if (watermark) {
        const watermarkBuffer = Buffer.from(watermark, 'base64');
        sharpInstance = sharpInstance.composite([{
          input: watermarkBuffer,
          gravity: 'southeast'
        }]);
      }
            
      // Configurar formato y compresión
      if (compress) {
        if (format === 'jpeg') {
          sharpInstance = sharpInstance.jpeg({ quality });
        } else if (format === 'png') {
          sharpInstance = sharpInstance.png({ compressionLevel: 9 });
        } else if (format === 'webp') {
          sharpInstance = sharpInstance.webp({ quality });
        }
      }
            
      await sharpInstance.toFile(outputPath);
            
      // Obtener información del archivo procesado
      const processedInfo = await this.getFileInfo(outputPath);
            
      return {
        success: true,
        outputPath,
        originalSize: (await this.getFileInfo(inputPath)).size,
        processedSize: processedInfo.size,
        compressionRatio: processedInfo.size / (await this.getFileInfo(inputPath)).size,
        options
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
     * Obtener información de video
     */
  async getVideoInfo(inputPath) {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(inputPath, (err, metadata) => {
        if (err) {
          reject(err);
        } else {
          const videoStream = metadata.streams.find(s => s.codec_type === 'video');
          const audioStream = metadata.streams.find(s => s.codec_type === 'audio');
                    
          resolve({
            duration: metadata.format.duration,
            size: metadata.format.size,
            bitrate: metadata.format.bit_rate,
            video: videoStream ? {
              codec: videoStream.codec_name,
              width: videoStream.width,
              height: videoStream.height,
              fps: eval(videoStream.r_frame_rate)
            } : null,
            audio: audioStream ? {
              codec: audioStream.codec_name,
              sampleRate: audioStream.sample_rate,
              channels: audioStream.channels
            } : null
          });
        }
      });
    });
  }

  /**
     * Procesar video con opciones avanzadas
     */
  async processVideo(inputPath, options = {}) {
    return new Promise(async(resolve, reject) => {
      try {
        const {
          width = null,
          height = null,
          quality = 'medium',
          format = 'mp4',
          startTime = null,
          duration = null,
          fps = null
        } = options;

        const outputPath = inputPath.replace(
          path.extname(inputPath), 
          `_processed.${format}`
        );
                
        let command = ffmpeg(inputPath);
                
        // Configurar dimensiones
        if (width && height) {
          command = command.size(`${width}x${height}`);
        }
                
        // Configurar FPS
        if (fps) {
          command = command.fps(fps);
        }
                
        // Configurar tiempo de inicio y duración
        if (startTime) {
          command = command.seekInput(startTime);
        }
                
        if (duration) {
          command = command.duration(duration);
        }
                
        // Configurar calidad
        const qualitySettings = {
          low: ['-crf', '28', '-preset', 'fast'],
          medium: ['-crf', '23', '-preset', 'medium'],
          high: ['-crf', '18', '-preset', 'slow']
        };
                
        command = command.outputOptions(qualitySettings[quality] || qualitySettings.medium);
                
        // Obtener información original
        const originalInfo = await this.getVideoInfo(inputPath);
                
        command
          .output(outputPath)
          .on('end', async() => {
            try {
              const processedInfo = await this.getVideoInfo(outputPath);
              resolve({
                success: true,
                outputPath,
                originalInfo,
                processedInfo,
                options
              });
            } catch (infoError) {
              resolve({
                success: true,
                outputPath,
                originalInfo,
                processedInfo: null,
                options,
                warning: 'No se pudo obtener información del video procesado'
              });
            }
          })
          .on('error', (err) => {
            reject(new Error(`Error procesando video: ${err.message}`));
          })
          .run();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
     * Obtener estadísticas del sistema multimedia
     */
  async getSystemStats() {
    try {
      const stats = {
        totalFiles: 0,
        totalSize: 0,
        byType: {}
      };

      for (const type of Object.keys(this.allowedTypes)) {
        const typeDir = path.join(this.uploadsDir, type);
        const typeStats = {
          count: 0,
          size: 0,
          files: []
        };

        if (await fs.pathExists(typeDir)) {
          const files = await fs.readdir(typeDir);
                    
          for (const file of files) {
            const filePath = path.join(typeDir, file);
            const fileInfo = await this.getFileInfo(filePath);
                        
            if (fileInfo.exists) {
              typeStats.count++;
              typeStats.size += fileInfo.size;
              typeStats.files.push({
                name: file,
                size: fileInfo.size,
                created: fileInfo.created,
                modified: fileInfo.modified
              });
            }
          }
        }

        stats.byType[type] = typeStats;
        stats.totalFiles += typeStats.count;
        stats.totalSize += typeStats.size;
      }

      return stats;
    } catch (error) {
      throw new Error(`Error obteniendo estadísticas: ${error.message}`);
    }
  }

  /**
     * Limpiar archivos antiguos
     */
  async cleanupOldFiles(days = 30, type = null) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
            
      const types = type ? [type] : Object.keys(this.allowedTypes);
      let deletedCount = 0;
      let freedSpace = 0;
            
      for (const fileType of types) {
        const typeDir = path.join(this.uploadsDir, fileType);
                
        if (await fs.pathExists(typeDir)) {
          const files = await fs.readdir(typeDir);
                    
          for (const file of files) {
            const filePath = path.join(typeDir, file);
            const fileInfo = await this.getFileInfo(filePath);
                        
            if (fileInfo.exists && fileInfo.created < cutoffDate) {
              freedSpace += fileInfo.size;
              await fs.unlink(filePath);
              deletedCount++;
            }
          }
        }
      }

      return {
        deletedFiles: deletedCount,
        freedSpace,
        cutoffDate
      };
    } catch (error) {
      throw new Error(`Error en limpieza: ${error.message}`);
    }
  }

  /**
     * Crear thumbnail para imagen
     */
  async createThumbnail(inputPath, size = 150) {
    try {
      const thumbnailPath = inputPath.replace(
        path.extname(inputPath),
        `_thumb_${size}.jpg`
      );

      await sharp(inputPath)
        .resize(size, size, {
          fit: 'cover',
          position: 'center'
        })
        .jpeg({ quality: 80 })
        .toFile(thumbnailPath);

      return {
        success: true,
        thumbnailPath,
        size
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
     * Validar integridad de archivo
     */
  async validateFileIntegrity(filePath) {
    try {
      const fileInfo = await this.getFileInfo(filePath);
            
      if (!fileInfo.exists) {
        return { valid: false, error: 'Archivo no existe' };
      }

      // Verificar que el archivo no esté corrupto
      const ext = path.extname(filePath).toLowerCase();
            
      if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) {
        // Validar imagen
        try {
          const metadata = await sharp(filePath).metadata();
          return { 
            valid: true, 
            type: 'image',
            metadata: {
              width: metadata.width,
              height: metadata.height,
              format: metadata.format,
              channels: metadata.channels
            }
          };
        } catch (sharpError) {
          return { valid: false, error: 'Imagen corrupta' };
        }
      }

      return { valid: true, type: 'unknown' };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }
}

export default MultimediaService;
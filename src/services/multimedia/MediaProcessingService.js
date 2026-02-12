/**
 * @fileoverview Servicio de procesamiento de medios
 * Extraído de multimedia.js para mejorar la modularidad
 */

import sharp from 'sharp';
import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs-extra';
import { createLogger } from '../core/core/logger.js';

const logger = createLogger('MEDIA_PROCESSING_SERVICE');

/**
 * @class MediaProcessingService
 * Servicio para procesamiento de archivos multimedia
 */
export class MediaProcessingService {
  constructor() {
    this.logger = logger;
  }

  /**
   * Procesar imagen con Sharp
   */
  async processImage(inputPath, options = {}) {
    try {
      const {
        width = 1920,
        height = 1080,
        quality = 85,
        format = 'jpeg',
        outputPath = null
      } = options;

      const outputFile = outputPath || inputPath.replace(
        path.extname(inputPath),
        `_processed.${format}`
      );

      await sharp(inputPath)
        .resize(width, height, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .jpeg({ quality })
        .toFile(outputFile);

      this.logger.info(`Imagen procesada: ${outputFile}`);
      return {
        success: true,
        outputPath: outputFile,
        originalSize: (await fs.stat(inputPath)).size,
        processedSize: (await fs.stat(outputFile)).size
      };
    } catch (error) {
      this.logger.error('Error procesando imagen:', error);
      throw error;
    }
  }

  /**
   * Obtener información de video
   */
  getVideoInfo(inputPath) {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(inputPath, (err, metadata) => {
        if (err) {
          reject(err);
        } else {
          resolve(metadata);
        }
      });
    });
  }

  /**
   * Procesar video con FFmpeg
   */
  processVideo(inputPath, options = {}) {
    return new Promise((resolve, reject) => {
      const {
        width = 1280,
        height = 720,
        bitrate = '1000k',
        outputPath = null
      } = options;

      const outputFile = outputPath || inputPath.replace(
        path.extname(inputPath),
        '_processed.mp4'
      );

      ffmpeg(inputPath)
        .size(`${width}x${height}`)
        .videoBitrate(bitrate)
        .output(outputFile)
        .on('end', () => {
          this.logger.info(`Video procesado: ${outputFile}`);
          resolve({
            success: true,
            outputPath: outputFile
          });
        })
        .on('error', (err) => {
          this.logger.error('Error procesando video:', err);
          reject(err);
        })
        .run();
    });
  }

  /**
   * Procesar audio
   */
  processAudio(inputPath, options = {}) {
    return new Promise((resolve, reject) => {
      const {
        bitrate = '128k',
        format = 'mp3',
        outputPath = null
      } = options;

      const outputFile = outputPath || inputPath.replace(
        path.extname(inputPath),
        `_processed.${format}`
      );

      ffmpeg(inputPath)
        .audioBitrate(bitrate)
        .format(format)
        .output(outputFile)
        .on('end', () => {
          this.logger.info(`Audio procesado: ${outputFile}`);
          resolve({
            success: true,
            outputPath: outputFile
          });
        })
        .on('error', (err) => {
          this.logger.error('Error procesando audio:', err);
          reject(err);
        })
        .run();
    });
  }

  /**
   * Generar thumbnail de video
   */
  generateVideoThumbnail(inputPath, options = {}) {
    return new Promise((resolve, reject) => {
      const {
        timemarks = ['50%'],
        size = '320x240',
        outputPath = null
      } = options;

      const outputDir = outputPath || path.dirname(inputPath);
      const filename = path.basename(inputPath, path.extname(inputPath));

      ffmpeg(inputPath)
        .screenshots({
          timemarks,
          size,
          filename: `${filename}_thumbnail.png`,
          folder: outputDir
        })
        .on('end', () => {
          const thumbnailPath = path.join(outputDir, `${filename}_thumbnail.png`);
          this.logger.info(`Thumbnail generado: ${thumbnailPath}`);
          resolve({
            success: true,
            thumbnailPath
          });
        })
        .on('error', (err) => {
          this.logger.error('Error generando thumbnail:', err);
          reject(err);
        });
    });
  }

  /**
   * Optimizar imagen para web
   */
  async optimizeImageForWeb(inputPath, options = {}) {
    try {
      const {
        maxWidth = 1920,
        maxHeight = 1080,
        quality = 85,
        generateWebP = true
      } = options;

      const results = [];
      const baseName = path.basename(inputPath, path.extname(inputPath));
      const outputDir = path.dirname(inputPath);

      // Generar versión JPEG optimizada
      const jpegPath = path.join(outputDir, `${baseName}_optimized.jpg`);
      await sharp(inputPath)
        .resize(maxWidth, maxHeight, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .jpeg({ quality })
        .toFile(jpegPath);

      results.push({
        format: 'jpeg',
        path: jpegPath,
        size: (await fs.stat(jpegPath)).size
      });

      // Generar versión WebP si se solicita
      if (generateWebP) {
        const webpPath = path.join(outputDir, `${baseName}_optimized.webp`);
        await sharp(inputPath)
          .resize(maxWidth, maxHeight, {
            fit: 'inside',
            withoutEnlargement: true
          })
          .webp({ quality })
          .toFile(webpPath);

        results.push({
          format: 'webp',
          path: webpPath,
          size: (await fs.stat(webpPath)).size
        });
      }

      this.logger.info(`Imagen optimizada para web: ${results.length} versiones generadas`);
      return {
        success: true,
        originalSize: (await fs.stat(inputPath)).size,
        optimizedVersions: results
      };
    } catch (error) {
      this.logger.error('Error optimizando imagen para web:', error);
      throw error;
    }
  }

  /**
   * Validar archivo multimedia
   */
  async validateMediaFile(filePath, type) {
    try {
      const stats = await fs.stat(filePath);
      const fileSize = stats.size;
      const maxSizes = {
        image: 10 * 1024 * 1024, // 10MB
        video: 100 * 1024 * 1024, // 100MB
        audio: 50 * 1024 * 1024, // 50MB
        document: 25 * 1024 * 1024 // 25MB
      };

      if (fileSize > maxSizes[type]) {
        throw new Error(`Archivo demasiado grande. Máximo permitido: ${maxSizes[type] / (1024 * 1024)}MB`);
      }

      return {
        valid: true,
        size: fileSize,
        type: type
      };
    } catch (error) {
      this.logger.error('Error validando archivo:', error);
      throw error;
    }
  }
}

export default MediaProcessingService;
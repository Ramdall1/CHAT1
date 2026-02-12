/**
 * Middleware de Optimización de Imágenes
 * Comprime automáticamente las imágenes subidas para mejorar el rendimiento
 */

import sharp from 'sharp';
import path from 'path';
import fs from 'fs-extra';
import { createLogger } from '../../services/core/core/logger.js';

class ImageOptimizer {
  constructor(options = {}) {
    this.options = {
      quality: options.quality || 80,
      maxWidth: options.maxWidth || 1920,
      maxHeight: options.maxHeight || 1080,
      format: options.format || 'jpeg',
      enableWebP: options.enableWebP || true,
      ...options
    };
    
    // Logger centralizado
    this.logger = createLogger('IMAGE_OPTIMIZER');
  }

  /**
   * Middleware para optimizar imágenes automáticamente
   */
  middleware() {
    return async(req, res, next) => {
      // Solo procesar si hay archivos subidos
      if (!req.files || req.files.length === 0) {
        return next();
      }

      try {
        const optimizedFiles = [];

        for (const file of req.files) {
          if (this.isImage(file.mimetype)) {
            const optimizedFile = await this.optimizeImage(file);
            optimizedFiles.push(optimizedFile);
          } else {
            optimizedFiles.push(file);
          }
        }

        req.files = optimizedFiles;
        next();
      } catch (error) {
        if (this.logger) this.logger.error('Error optimizando imágenes:', error);
        next(); // Continuar sin optimización en caso de error
      }
    };
  }

  /**
   * Verifica si el archivo es una imagen
   */
  isImage(mimetype) {
    return mimetype && mimetype.startsWith('image/');
  }

  /**
   * Optimiza una imagen individual
   */
  async optimizeImage(file) {
    try {
      const originalPath = file.path;
      const originalSize = file.size;
      const ext = path.extname(file.filename);
      const nameWithoutExt = path.basename(file.filename, ext);
      
      // Crear nombre optimizado
      const optimizedFilename = `${nameWithoutExt}_optimized.${this.options.format}`;
      const optimizedPath = path.join(path.dirname(originalPath), optimizedFilename);

      // Optimizar imagen con Sharp
      const sharpInstance = sharp(originalPath);
      
      // Obtener metadatos de la imagen
      const metadata = await sharpInstance.metadata();
      
      // Configurar optimización
      let pipeline = sharpInstance;
      
      // Redimensionar si es necesario
      if (metadata.width > this.options.maxWidth || metadata.height > this.options.maxHeight) {
        pipeline = pipeline.resize(this.options.maxWidth, this.options.maxHeight, {
          fit: 'inside',
          withoutEnlargement: true
        });
      }

      // Aplicar formato y calidad
      if (this.options.format === 'jpeg') {
        pipeline = pipeline.jpeg({ quality: this.options.quality });
      } else if (this.options.format === 'png') {
        pipeline = pipeline.png({ quality: this.options.quality });
      } else if (this.options.format === 'webp') {
        pipeline = pipeline.webp({ quality: this.options.quality });
      }

      // Guardar imagen optimizada
      await pipeline.toFile(optimizedPath);

      // Obtener estadísticas de optimización
      const optimizedStats = await fs.stat(optimizedPath);
      const compressionRatio = ((originalSize - optimizedStats.size) / originalSize * 100).toFixed(2);

      if (this.logger) {
        this.logger.info(`📸 Imagen optimizada: ${file.filename}`);
        this.logger.info(`   Tamaño original: ${(originalSize / 1024).toFixed(2)} KB`);
        this.logger.info(`   Tamaño optimizado: ${(optimizedStats.size / 1024).toFixed(2)} KB`);
        this.logger.info(`   Compresión: ${compressionRatio}%`);
      }

      // Eliminar archivo original si la optimización fue exitosa
      await fs.remove(originalPath);

      // Actualizar información del archivo
      return {
        ...file,
        filename: optimizedFilename,
        path: optimizedPath,
        size: optimizedStats.size,
        mimetype: `image/${this.options.format}`,
        optimized: true,
        originalSize: originalSize,
        compressionRatio: parseFloat(compressionRatio)
      };

    } catch (error) {
      if (this.logger) this.logger.error(`Error optimizando imagen ${file.filename}:`, error);
      // Retornar archivo original en caso de error
      return file;
    }
  }

  /**
   * Optimiza una imagen desde una ruta específica
   */
  async optimizeImageFromPath(inputPath, outputPath = null) {
    try {
      if (!outputPath) {
        const ext = path.extname(inputPath);
        const nameWithoutExt = path.basename(inputPath, ext);
        const dir = path.dirname(inputPath);
        outputPath = path.join(dir, `${nameWithoutExt}_optimized.${this.options.format}`);
      }

      const originalStats = await fs.stat(inputPath);
      
      const sharpInstance = sharp(inputPath);
      const metadata = await sharpInstance.metadata();
      
      let pipeline = sharpInstance;
      
      if (metadata.width > this.options.maxWidth || metadata.height > this.options.maxHeight) {
        pipeline = pipeline.resize(this.options.maxWidth, this.options.maxHeight, {
          fit: 'inside',
          withoutEnlargement: true
        });
      }

      if (this.options.format === 'jpeg') {
        pipeline = pipeline.jpeg({ quality: this.options.quality });
      } else if (this.options.format === 'png') {
        pipeline = pipeline.png({ quality: this.options.quality });
      } else if (this.options.format === 'webp') {
        pipeline = pipeline.webp({ quality: this.options.quality });
      }

      await pipeline.toFile(outputPath);

      const optimizedStats = await fs.stat(outputPath);
      const compressionRatio = ((originalStats.size - optimizedStats.size) / originalStats.size * 100).toFixed(2);

      return {
        originalPath: inputPath,
        optimizedPath: outputPath,
        originalSize: originalStats.size,
        optimizedSize: optimizedStats.size,
        compressionRatio: parseFloat(compressionRatio),
        success: true
      };

    } catch (error) {
      if (this.logger) this.logger.error('Error optimizando imagen:', error);
      return {
        originalPath: inputPath,
        error: error.message,
        success: false
      };
    }
  }

  /**
   * Genera múltiples versiones de una imagen (thumbnails, diferentes tamaños)
   */
  async generateImageVariants(inputPath, variants = []) {
    const defaultVariants = [
      { name: 'thumbnail', width: 150, height: 150, quality: 70 },
      { name: 'small', width: 400, height: 400, quality: 75 },
      { name: 'medium', width: 800, height: 800, quality: 80 },
      { name: 'large', width: 1200, height: 1200, quality: 85 }
    ];

    const variantsToGenerate = variants.length > 0 ? variants : defaultVariants;
    const results = [];

    for (const variant of variantsToGenerate) {
      try {
        const ext = path.extname(inputPath);
        const nameWithoutExt = path.basename(inputPath, ext);
        const dir = path.dirname(inputPath);
        const outputPath = path.join(dir, `${nameWithoutExt}_${variant.name}.${this.options.format}`);

        await sharp(inputPath)
          .resize(variant.width, variant.height, {
            fit: 'cover',
            position: 'center'
          })
          .jpeg({ quality: variant.quality || this.options.quality })
          .toFile(outputPath);

        const stats = await fs.stat(outputPath);
        
        results.push({
          name: variant.name,
          path: outputPath,
          size: stats.size,
          width: variant.width,
          height: variant.height,
          success: true
        });

      } catch (error) {
        results.push({
          name: variant.name,
          error: error.message,
          success: false
        });
      }
    }

    return results;
  }
}

export default ImageOptimizer;
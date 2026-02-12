import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs-extra';
import sharp from 'sharp';
import ffmpeg from 'fluent-ffmpeg';
import crypto from 'crypto';
import mime from 'mime-types';
import ImageOptimizer from '../middleware/ImageOptimizer.js';
import { createLogger } from '../../services/core/core/logger.js';

const router = express.Router();
const logger = createLogger('MULTIMEDIA_ROUTES');

// Configurar optimizador de imágenes
const imageOptimizer = new ImageOptimizer({
  quality: 85,
  maxWidth: 1920,
  maxHeight: 1080,
  format: 'jpeg',
  enableWebP: true
});

// Configuración de almacenamiento optimizado
const createStorage = (type) => {
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
};

// Configuraciones de multer por tipo de archivo
const imageUpload = multer({
  storage: createStorage('images'),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de imagen no permitido. Solo JPEG, PNG, GIF y WebP.'));
    }
  }
});

const videoUpload = multer({
  storage: createStorage('videos'),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['video/mp4', 'video/avi', 'video/mov', 'video/wmv'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de video no permitido. Solo MP4, AVI, MOV y WMV.'));
    }
  }
});

const audioUpload = multer({
  storage: createStorage('audio'),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['audio/mp3', 'audio/wav', 'audio/ogg', 'audio/m4a'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de audio no permitido. Solo MP3, WAV, OGG y M4A.'));
    }
  }
});

const documentUpload = multer({
  storage: createStorage('documents'),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain'
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de documento no permitido.'));
    }
  }
});

// Utilidades para procesamiento de archivos
const processImage = async(inputPath, options = {}) => {
  const {
    width = null,
    height = null,
    quality = 80,
    format = 'jpeg',
    compress = true
  } = options;

  const outputPath = inputPath.replace(path.extname(inputPath), `_processed.${format}`);
    
  let sharpInstance = sharp(inputPath);
    
  if (width || height) {
    sharpInstance = sharpInstance.resize(width, height, {
      fit: 'inside',
      withoutEnlargement: true
    });
  }
    
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
  return outputPath;
};

const getVideoInfo = (inputPath) => {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(inputPath, (err, metadata) => {
      if (err) reject(err);
      else resolve(metadata);
    });
  });
};

const processVideo = (inputPath, options = {}) => {
  return new Promise((resolve, reject) => {
    const {
      width = null,
      height = null,
      quality = 'medium',
      format = 'mp4'
    } = options;

    const outputPath = inputPath.replace(path.extname(inputPath), `_processed.${format}`);
        
    let command = ffmpeg(inputPath);
        
    if (width && height) {
      command = command.size(`${width}x${height}`);
    }
        
    // Configurar calidad
    const qualitySettings = {
      low: ['-crf', '28'],
      medium: ['-crf', '23'],
      high: ['-crf', '18']
    };
        
    command = command.outputOptions(qualitySettings[quality] || qualitySettings.medium);
        
    command
      .output(outputPath)
      .on('end', () => resolve(outputPath))
      .on('error', reject)
      .run();
  });
};

// Middleware de validación de seguridad
const validateFile = (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      error: 'No se ha subido ningún archivo'
    });
  }

  // Validar tamaño del archivo
  const maxSizes = {
    images: 10 * 1024 * 1024,
    videos: 100 * 1024 * 1024,
    audio: 50 * 1024 * 1024,
    documents: 25 * 1024 * 1024
  };

  const fileType = req.route.path.includes('image') ? 'images' :
    req.route.path.includes('video') ? 'videos' :
      req.route.path.includes('audio') ? 'audio' : 'documents';

  if (req.file.size > maxSizes[fileType]) {
    // Eliminar archivo si excede el tamaño
    fs.unlink(req.file.path).catch(error => logger.error('Error eliminando archivo temporal:', error));
    return res.status(400).json({
      success: false,
      error: `Archivo demasiado grande. Máximo permitido: ${maxSizes[fileType] / (1024 * 1024)}MB`
    });
  }

  // Validar extensión vs MIME type
  const expectedMime = mime.lookup(req.file.originalname);
  if (expectedMime && expectedMime !== req.file.mimetype) {
    fs.unlink(req.file.path).catch(error => {
      logger.error('Error eliminando archivo inválido:', error);
    });
    return res.status(400).json({
      success: false,
      error: 'Tipo de archivo no coincide con la extensión'
    });
  }

  next();
};

// Rutas de la API

/**
 * @route GET /api/multimedia/status
 * @desc Obtener estado del sistema multimedia
 */
router.get('/status', async(req, res) => {
  try {
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
    const stats = {
      status: 'active',
      uploadsDirectory: uploadsDir,
      diskSpace: {},
      fileCount: {},
      totalSize: {}
    };

    // Obtener estadísticas por tipo
    const types = ['images', 'videos', 'audio', 'documents'];
        
    for (const type of types) {
      const typeDir = path.join(uploadsDir, type);
      if (await fs.pathExists(typeDir)) {
        const files = await fs.readdir(typeDir);
        stats.fileCount[type] = files.length;
                
        let totalSize = 0;
        for (const file of files) {
          const filePath = path.join(typeDir, file);
          const stat = await fs.stat(filePath);
          totalSize += stat.size;
        }
        stats.totalSize[type] = totalSize;
      } else {
        stats.fileCount[type] = 0;
        stats.totalSize[type] = 0;
      }
    }

    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route POST /api/multimedia/upload/image
 * @desc Subir y procesar imagen
 */
router.post('/upload/image', imageUpload.single('image'), validateFile, async(req, res) => {
  try {
    const { width, height, quality, format, compress } = req.body;
        
    let fileInfo = {
      originalName: req.file.originalname,
      filename: req.file.filename,
      path: req.file.path,
      size: req.file.size,
      mimetype: req.file.mimetype,
      url: `/uploads/images/${req.file.filename}`
    };

    // Optimizar imagen automáticamente
    try {
      const optimizedFile = await imageOptimizer.optimizeImage(req.file);
      if (optimizedFile.optimized) {
        fileInfo = {
          ...fileInfo,
          filename: optimizedFile.filename,
          path: optimizedFile.path,
          size: optimizedFile.size,
          mimetype: optimizedFile.mimetype,
          url: `/uploads/images/${optimizedFile.filename}`,
          optimization: {
            originalSize: optimizedFile.originalSize,
            optimizedSize: optimizedFile.size,
            compressionRatio: optimizedFile.compressionRatio,
            optimized: true
          }
        };
        logger.info(`📸 Imagen optimizada automáticamente: ${optimizedFile.compressionRatio}% de compresión`);
      }
    } catch (optimizationError) {
      logger.warn('⚠️ Error en optimización automática:', optimizationError.message);
    }

    // Procesar imagen si se especifican opciones adicionales
    if (width || height || quality || format || compress) {
      const processOptions = {
        width: width ? parseInt(width) : null,
        height: height ? parseInt(height) : null,
        quality: quality ? parseInt(quality) : 80,
        format: format || 'jpeg',
        compress: compress === 'true'
      };

      const processedPath = await processImage(fileInfo.path, processOptions);
      const processedFilename = path.basename(processedPath);
            
      fileInfo.processed = {
        filename: processedFilename,
        path: processedPath,
        url: `/uploads/images/${processedFilename}`,
        options: processOptions
      };
    }

    res.json({
      success: true,
      data: fileInfo,
      message: 'Imagen subida exitosamente'
    });
  } catch (error) {
    // Limpiar archivo en caso de error
    if (req.file) {
      fs.unlink(req.file.path).catch(error => logger.error('Error eliminando archivo temporal:', error));
    }
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route POST /api/multimedia/upload/video
 * @desc Subir y procesar video
 */
router.post('/upload/video', videoUpload.single('video'), validateFile, async(req, res) => {
  try {
    const { width, height, quality, format } = req.body;
        
    const fileInfo = {
      originalName: req.file.originalname,
      filename: req.file.filename,
      path: req.file.path,
      size: req.file.size,
      mimetype: req.file.mimetype,
      url: `/uploads/videos/${req.file.filename}`
    };

    // Obtener información del video
    try {
      const videoInfo = await getVideoInfo(req.file.path);
      fileInfo.metadata = {
        duration: videoInfo.format.duration,
        bitrate: videoInfo.format.bit_rate,
        streams: videoInfo.streams.length
      };
    } catch (metaError) {
      logger.warn('No se pudo obtener metadata del video:', metaError.message);
    }

    // Procesar video si se especifican opciones
    if (width || height || quality || format) {
      const processOptions = {
        width: width ? parseInt(width) : null,
        height: height ? parseInt(height) : null,
        quality: quality || 'medium',
        format: format || 'mp4'
      };

      try {
        const processedPath = await processVideo(req.file.path, processOptions);
        const processedFilename = path.basename(processedPath);
                
        fileInfo.processed = {
          filename: processedFilename,
          path: processedPath,
          url: `/uploads/videos/${processedFilename}`,
          options: processOptions
        };
      } catch (processError) {
        logger.warn('No se pudo procesar el video:', processError.message);
        fileInfo.processError = processError.message;
      }
    }

    res.json({
      success: true,
      data: fileInfo,
      message: 'Video subido exitosamente'
    });
  } catch (error) {
    if (req.file) {
      fs.unlink(req.file.path).catch(error => logger.error('Error eliminando archivo temporal:', error));
    }
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route POST /api/multimedia/upload/audio
 * @desc Subir archivo de audio
 */
router.post('/upload/audio', audioUpload.single('audio'), validateFile, async(req, res) => {
  try {
    const fileInfo = {
      originalName: req.file.originalname,
      filename: req.file.filename,
      path: req.file.path,
      size: req.file.size,
      mimetype: req.file.mimetype,
      url: `/uploads/audio/${req.file.filename}`
    };

    res.json({
      success: true,
      data: fileInfo,
      message: 'Audio subido exitosamente'
    });
  } catch (error) {
    if (req.file) {
      fs.unlink(req.file.path).catch(error => logger.error('Error eliminando archivo temporal:', error));
    }
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route POST /api/multimedia/upload/document
 * @desc Subir documento
 */
router.post('/upload/document', documentUpload.single('document'), validateFile, async(req, res) => {
  try {
    const fileInfo = {
      originalName: req.file.originalname,
      filename: req.file.filename,
      path: req.file.path,
      size: req.file.size,
      mimetype: req.file.mimetype,
      url: `/uploads/documents/${req.file.filename}`
    };

    res.json({
      success: true,
      data: fileInfo,
      message: 'Documento subido exitosamente'
    });
  } catch (error) {
    if (req.file) {
      fs.unlink(req.file.path).catch(error => logger.error('Error eliminando archivo temporal:', error));
    }
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route GET /api/multimedia/files
 * @desc Listar archivos multimedia
 */
router.get('/files', async(req, res) => {
  try {
    const { type, limit = 50, offset = 0 } = req.query;
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
        
    const files = [];
    const types = type ? [type] : ['images', 'videos', 'audio', 'documents'];
        
    for (const fileType of types) {
      const typeDir = path.join(uploadsDir, fileType);
      if (await fs.pathExists(typeDir)) {
        const dirFiles = await fs.readdir(typeDir);
                
        for (const file of dirFiles) {
          const filePath = path.join(typeDir, file);
          const stats = await fs.stat(filePath);
                    
          files.push({
            name: file,
            type: fileType,
            size: stats.size,
            created: stats.birthtime,
            modified: stats.mtime,
            url: `/uploads/${fileType}/${file}`
          });
        }
      }
    }

    // Ordenar por fecha de creación (más recientes primero)
    files.sort((a, b) => new Date(b.created) - new Date(a.created));
        
    // Aplicar paginación
    const startIndex = parseInt(offset);
    const endIndex = startIndex + parseInt(limit);
    const paginatedFiles = files.slice(startIndex, endIndex);

    res.json({
      success: true,
      data: {
        files: paginatedFiles,
        total: files.length,
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route DELETE /api/multimedia/files/:type/:filename
 * @desc Eliminar archivo multimedia
 */
router.delete('/files/:type/:filename', async(req, res) => {
  try {
    const { type, filename } = req.params;
    const allowedTypes = ['images', 'videos', 'audio', 'documents'];
        
    if (!allowedTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'Tipo de archivo no válido'
      });
    }

    const filePath = path.join(process.cwd(), 'public', 'uploads', type, filename);
        
    if (!(await fs.pathExists(filePath))) {
      return res.status(404).json({
        success: false,
        error: 'Archivo no encontrado'
      });
    }

    await fs.unlink(filePath);
        
    // También eliminar versión procesada si existe
    const processedPath = filePath.replace(path.extname(filePath), '_processed' + path.extname(filePath));
    if (await fs.pathExists(processedPath)) {
      await fs.unlink(processedPath);
    }

    res.json({
      success: true,
      message: 'Archivo eliminado exitosamente'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route POST /api/multimedia/cleanup
 * @desc Limpiar archivos antiguos
 */
router.post('/cleanup', async(req, res) => {
  try {
    const { days = 30, type } = req.body;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - parseInt(days));
        
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
    const types = type ? [type] : ['images', 'videos', 'audio', 'documents'];
        
    let deletedCount = 0;
    let freedSpace = 0;
        
    for (const fileType of types) {
      const typeDir = path.join(uploadsDir, fileType);
      if (await fs.pathExists(typeDir)) {
        const files = await fs.readdir(typeDir);
                
        for (const file of files) {
          const filePath = path.join(typeDir, file);
          const stats = await fs.stat(filePath);
                    
          if (stats.birthtime < cutoffDate) {
            freedSpace += stats.size;
            await fs.unlink(filePath);
            deletedCount++;
          }
        }
      }
    }

    res.json({
      success: true,
      data: {
        deletedFiles: deletedCount,
        freedSpace: freedSpace,
        cutoffDate: cutoffDate.toISOString()
      },
      message: `Limpieza completada: ${deletedCount} archivos eliminados`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
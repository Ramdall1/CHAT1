/**
 * @fileoverview Rutas de Multimedia
 * Extraído de multimedia.js para mejorar la modularidad
 */

import express from 'express';
import path from 'path';
import fs from 'fs/promises';
import { MulterConfigService } from '../services/multimedia/MulterConfigService.js';
import { MediaProcessingService } from '../services/multimedia/MediaProcessingService.js';
import { createLogger } from '../services/core/core/logger.js';

const router = express.Router();
const logger = createLogger('MULTIMEDIA_ROUTES');

// Inicializar servicios
const multerConfig = new MulterConfigService();
const mediaProcessor = new MediaProcessingService();

/**
 * Middleware para validar archivos
 */
const validateFile = (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'No se ha proporcionado ningún archivo'
    });
  }
  next();
};

/**
 * Middleware para manejo de errores de multer
 */
const handleMulterError = (error, req, res, next) => {
  if (error) {
    logger.error('Error de Multer:', error);
    
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'El archivo es demasiado grande'
      });
    }
    
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        message: 'Campo de archivo inesperado'
      });
    }
    
    return res.status(400).json({
      success: false,
      message: 'Error al procesar el archivo',
      error: error.message
    });
  }
  next();
};

// ==================== RUTAS DE SUBIDA ====================

/**
 * Subir imagen
 */
router.post('/upload/image', 
  multerConfig.createMulterInstance('image').single('image'),
  handleMulterError,
  validateFile,
  async (req, res) => {
    try {
      const file = req.file;
      
      // Procesar imagen
      const processedImage = await mediaProcessor.processImage(file.path, {
        resize: req.body.resize ? JSON.parse(req.body.resize) : null,
        quality: req.body.quality ? parseInt(req.body.quality) : 80,
        format: req.body.format || 'jpeg'
      });

      res.json({
        success: true,
        message: 'Imagen subida y procesada exitosamente',
        file: {
          filename: file.filename,
          originalname: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
          path: file.path,
          processed: processedImage
        }
      });
    } catch (error) {
      logger.error('Error al procesar imagen:', error);
      res.status(500).json({
        success: false,
        message: 'Error al procesar la imagen',
        error: error.message
      });
    }
  }
);

/**
 * Subir video
 */
router.post('/upload/video',
  multerConfig.createMulterInstance('video').single('video'),
  handleMulterError,
  validateFile,
  async (req, res) => {
    try {
      const file = req.file;
      
      // Obtener información del video
      const videoInfo = await mediaProcessor.getVideoInfo(file.path);
      
      // Generar miniatura si se solicita
      let thumbnail = null;
      if (req.body.generateThumbnail === 'true') {
        thumbnail = await mediaProcessor.generateVideoThumbnail(file.path);
      }

      res.json({
        success: true,
        message: 'Video subido exitosamente',
        file: {
          filename: file.filename,
          originalname: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
          path: file.path,
          info: videoInfo,
          thumbnail
        }
      });
    } catch (error) {
      logger.error('Error al procesar video:', error);
      res.status(500).json({
        success: false,
        message: 'Error al procesar el video',
        error: error.message
      });
    }
  }
);

/**
 * Subir audio
 */
router.post('/upload/audio',
  multerConfig.createMulterInstance('audio').single('audio'),
  handleMulterError,
  validateFile,
  async (req, res) => {
    try {
      const file = req.file;
      
      // Procesar audio
      const processedAudio = await mediaProcessor.processAudio(file.path, {
        bitrate: req.body.bitrate || '128k',
        format: req.body.format || 'mp3'
      });

      res.json({
        success: true,
        message: 'Audio subido y procesado exitosamente',
        file: {
          filename: file.filename,
          originalname: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
          path: file.path,
          processed: processedAudio
        }
      });
    } catch (error) {
      logger.error('Error al procesar audio:', error);
      res.status(500).json({
        success: false,
        message: 'Error al procesar el audio',
        error: error.message
      });
    }
  }
);

/**
 * Subir documento
 */
router.post('/upload/document',
  multerConfig.createMulterInstance('document').single('document'),
  handleMulterError,
  validateFile,
  async (req, res) => {
    try {
      const file = req.file;
      
      // Validar documento
      const isValid = await mediaProcessor.validateFile(file.path, file.mimetype);
      
      if (!isValid) {
        return res.status(400).json({
          success: false,
          message: 'El documento no es válido o está corrupto'
        });
      }

      res.json({
        success: true,
        message: 'Documento subido exitosamente',
        file: {
          filename: file.filename,
          originalname: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
          path: file.path
        }
      });
    } catch (error) {
      logger.error('Error al procesar documento:', error);
      res.status(500).json({
        success: false,
        message: 'Error al procesar el documento',
        error: error.message
      });
    }
  }
);

/**
 * Subida múltiple de archivos
 */
router.post('/upload/multiple',
  multerConfig.createMulterInstance('image').array('files', 10),
  handleMulterError,
  async (req, res) => {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No se han proporcionado archivos'
        });
      }

      const results = [];
      
      for (const file of req.files) {
        try {
          const result = {
            filename: file.filename,
            originalname: file.originalname,
            mimetype: file.mimetype,
            size: file.size,
            path: file.path,
            status: 'uploaded'
          };
          
          // Procesar según el tipo de archivo
          if (file.mimetype.startsWith('image/')) {
            result.processed = await mediaProcessor.processImage(file.path);
          } else if (file.mimetype.startsWith('video/')) {
            result.info = await mediaProcessor.getVideoInfo(file.path);
          }
          
          results.push(result);
        } catch (error) {
          results.push({
            filename: file.filename,
            originalname: file.originalname,
            status: 'error',
            error: error.message
          });
        }
      }

      res.json({
        success: true,
        message: `${results.length} archivos procesados`,
        files: results
      });
    } catch (error) {
      logger.error('Error al procesar archivos múltiples:', error);
      res.status(500).json({
        success: false,
        message: 'Error al procesar los archivos',
        error: error.message
      });
    }
  }
);

// ==================== RUTAS DE LISTADO ====================

/**
 * Listar archivos por tipo
 */
router.get('/list/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const { page = 1, limit = 20 } = req.query;
    
    const validTypes = ['images', 'videos', 'audio', 'documents'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Tipo de archivo no válido'
      });
    }
    
    const uploadDir = path.join(process.cwd(), 'uploads', type);
    
    try {
      const files = await fs.readdir(uploadDir);
      const start = (page - 1) * limit;
      const end = start + parseInt(limit);
      const paginatedFiles = files.slice(start, end);
      
      const fileDetails = await Promise.all(
        paginatedFiles.map(async (filename) => {
          try {
            const filePath = path.join(uploadDir, filename);
            const stats = await fs.stat(filePath);
            
            return {
              filename,
              size: stats.size,
              created: stats.birthtime,
              modified: stats.mtime,
              path: `/uploads/${type}/${filename}`
            };
          } catch (error) {
            return {
              filename,
              error: 'No se pudo obtener información del archivo'
            };
          }
        })
      );
      
      res.json({
        success: true,
        type,
        files: fileDetails,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: files.length,
          totalPages: Math.ceil(files.length / limit)
        }
      });
    } catch (error) {
      res.json({
        success: true,
        type,
        files: [],
        message: 'Directorio no encontrado o vacío'
      });
    }
  } catch (error) {
    logger.error('Error al listar archivos:', error);
    res.status(500).json({
      success: false,
      message: 'Error al listar archivos',
      error: error.message
    });
  }
});

/**
 * Obtener información de un archivo específico
 */
router.get('/info/:type/:filename', async (req, res) => {
  try {
    const { type, filename } = req.params;
    const filePath = path.join(process.cwd(), 'uploads', type, filename);
    
    try {
      const stats = await fs.stat(filePath);
      const fileInfo = {
        filename,
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
        path: `/uploads/${type}/${filename}`
      };
      
      // Información adicional según el tipo
      if (type === 'videos') {
        fileInfo.videoInfo = await mediaProcessor.getVideoInfo(filePath);
      }
      
      res.json({
        success: true,
        file: fileInfo
      });
    } catch (error) {
      res.status(404).json({
        success: false,
        message: 'Archivo no encontrado'
      });
    }
  } catch (error) {
    logger.error('Error al obtener información del archivo:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener información del archivo',
      error: error.message
    });
  }
});

// ==================== RUTAS DE ELIMINACIÓN ====================

/**
 * Eliminar archivo específico
 */
router.delete('/delete/:type/:filename', async (req, res) => {
  try {
    const { type, filename } = req.params;
    const filePath = path.join(process.cwd(), 'uploads', type, filename);
    
    try {
      await fs.unlink(filePath);
      
      res.json({
        success: true,
        message: 'Archivo eliminado exitosamente',
        filename
      });
    } catch (error) {
      res.status(404).json({
        success: false,
        message: 'Archivo no encontrado'
      });
    }
  } catch (error) {
    logger.error('Error al eliminar archivo:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar archivo',
      error: error.message
    });
  }
});

/**
 * Limpiar archivos antiguos
 */
router.delete('/cleanup/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const { days = 30 } = req.query;
    
    const uploadDir = path.join(process.cwd(), 'uploads', type);
    const cutoffDate = new Date(Date.now() - (days * 24 * 60 * 60 * 1000));
    
    try {
      const files = await fs.readdir(uploadDir);
      const deletedFiles = [];
      
      for (const filename of files) {
        try {
          const filePath = path.join(uploadDir, filename);
          const stats = await fs.stat(filePath);
          
          if (stats.mtime < cutoffDate) {
            await fs.unlink(filePath);
            deletedFiles.push(filename);
          }
        } catch (error) {
          logger.warn(`Error al procesar archivo ${filename}:`, error);
        }
      }
      
      res.json({
        success: true,
        message: `Limpieza completada. ${deletedFiles.length} archivos eliminados`,
        deletedFiles,
        cutoffDate
      });
    } catch (error) {
      res.json({
        success: true,
        message: 'Directorio no encontrado o vacío',
        deletedFiles: []
      });
    }
  } catch (error) {
    logger.error('Error al limpiar archivos:', error);
    res.status(500).json({
      success: false,
      message: 'Error al limpiar archivos',
      error: error.message
    });
  }
});

// ==================== RUTAS DE OPTIMIZACIÓN ====================

/**
 * Optimizar imagen para web
 */
router.post('/optimize/image/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    const { quality = 80, format = 'webp' } = req.body;
    
    const imagePath = path.join(process.cwd(), 'uploads', 'images', filename);
    
    try {
      const optimized = await mediaProcessor.optimizeImageForWeb(imagePath, {
        quality: parseInt(quality),
        format
      });
      
      res.json({
        success: true,
        message: 'Imagen optimizada exitosamente',
        original: filename,
        optimized
      });
    } catch (error) {
      res.status(404).json({
        success: false,
        message: 'Imagen no encontrada'
      });
    }
  } catch (error) {
    logger.error('Error al optimizar imagen:', error);
    res.status(500).json({
      success: false,
      message: 'Error al optimizar imagen',
      error: error.message
    });
  }
});

/**
 * Generar miniatura de video
 */
router.post('/thumbnail/video/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    const { time = '00:00:01', size = '320x240' } = req.body;
    
    const videoPath = path.join(process.cwd(), 'uploads', 'videos', filename);
    
    try {
      const thumbnail = await mediaProcessor.generateVideoThumbnail(videoPath, {
        time,
        size
      });
      
      res.json({
        success: true,
        message: 'Miniatura generada exitosamente',
        video: filename,
        thumbnail
      });
    } catch (error) {
      res.status(404).json({
        success: false,
        message: 'Video no encontrado'
      });
    }
  } catch (error) {
    logger.error('Error al generar miniatura:', error);
    res.status(500).json({
      success: false,
      message: 'Error al generar miniatura',
      error: error.message
    });
  }
});

export default router;
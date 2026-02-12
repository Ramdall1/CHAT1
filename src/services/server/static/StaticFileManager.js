/**
 * @fileoverview Gestor de Archivos Estáticos del Servidor
 * 
 * Módulo especializado para la configuración y gestión de archivos estáticos
 * del servidor Express. Centraliza toda la lógica de servir assets.
 * 
 * @author ChatBot Enterprise Team
 * @version 1.0.0
 */

import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createLogger } from '../../core/core/logger.js';

const logger = createLogger('STATIC_FILE_MANAGER');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Gestor de Archivos Estáticos
 */
export class StaticFileManager {
  constructor(app, config = {}) {
    this.app = app;
    this.config = {
      clientPath: config.clientPath || path.join(__dirname, '../../../../client'),
      publicPath: config.publicPath || path.join(__dirname, '../../../../public'),
      uploadsPath: config.uploadsPath || path.join(__dirname, '../../../../uploads'),
      enableClientServing: config.enableClientServing !== false,
      enablePublicServing: config.enablePublicServing !== false,
      enableUploadsServing: config.enableUploadsServing !== false,
      enableSPA: config.enableSPA !== false, // Single Page Application support
      cacheControl: config.cacheControl || 'public, max-age=3600',
      ...config
    };
    
    this.servedPaths = [];
  }

  /**
   * Configurar todos los archivos estáticos
   */
  setupAll() {
    try {
      logger.info('Configurando servicio de archivos estáticos...');

      this.setupClientFiles();
      this.setupPublicFiles();
      this.setupUploadsFiles();
      this.setupSPASupport();

      logger.info(`Archivos estáticos configurados (${this.servedPaths.length} rutas activas)`);
      
    } catch (error) {
      logger.error('Error configurando archivos estáticos:', error);
      throw error;
    }
  }

  /**
   * Configurar archivos del cliente
   */
  setupClientFiles() {
    if (!this.config.enableClientServing) {
      logger.info('Servicio de archivos del cliente deshabilitado');
      return;
    }

    try {
      if (fs.existsSync(this.config.clientPath)) {
        this.app.use(express.static(this.config.clientPath, {
          maxAge: this.config.cacheControl,
          etag: true,
          lastModified: true
        }));
        
        this.servedPaths.push(this.config.clientPath);
        logger.info(`📁 Sirviendo archivos del cliente desde: ${this.config.clientPath}`);
      } else {
        logger.warn(`📁 Directorio de cliente no encontrado: ${this.config.clientPath}`);
      }

    } catch (error) {
      logger.error('Error configurando archivos del cliente:', error);
      throw error;
    }
  }

  /**
   * Configurar archivos públicos
   */
  setupPublicFiles() {
    if (!this.config.enablePublicServing) {
      logger.info('Servicio de archivos públicos deshabilitado');
      return;
    }

    try {
      if (fs.existsSync(this.config.publicPath)) {
        this.app.use('/public', express.static(this.config.publicPath, {
          maxAge: this.config.cacheControl,
          etag: true,
          lastModified: true
        }));
        
        this.servedPaths.push(this.config.publicPath);
        logger.info(`📁 Sirviendo archivos públicos desde: ${this.config.publicPath}`);
      } else {
        logger.warn(`📁 Directorio público no encontrado: ${this.config.publicPath}`);
        
        // Crear directorio público si no existe
        try {
          fs.mkdirSync(this.config.publicPath, { recursive: true });
          logger.info(`📁 Directorio público creado: ${this.config.publicPath}`);
        } catch (createError) {
          logger.error('Error creando directorio público:', createError);
        }
      }

    } catch (error) {
      logger.error('Error configurando archivos públicos:', error);
      throw error;
    }
  }

  /**
   * Configurar archivos de uploads
   */
  setupUploadsFiles() {
    if (!this.config.enableUploadsServing) {
      logger.info('Servicio de archivos de uploads deshabilitado');
      return;
    }

    try {
      if (fs.existsSync(this.config.uploadsPath)) {
        this.app.use('/uploads', express.static(this.config.uploadsPath, {
          maxAge: this.config.cacheControl,
          etag: true,
          lastModified: true
        }));
        
        this.servedPaths.push(this.config.uploadsPath);
        logger.info(`📁 Sirviendo archivos de uploads desde: ${this.config.uploadsPath}`);
      } else {
        logger.warn(`📁 Directorio de uploads no encontrado: ${this.config.uploadsPath}`);
        
        // Crear directorio de uploads si no existe
        try {
          fs.mkdirSync(this.config.uploadsPath, { recursive: true });
          logger.info(`📁 Directorio de uploads creado: ${this.config.uploadsPath}`);
        } catch (createError) {
          logger.error('Error creando directorio de uploads:', createError);
        }
      }

    } catch (error) {
      logger.error('Error configurando archivos de uploads:', error);
      throw error;
    }
  }

  /**
   * Configurar soporte para SPA (Single Page Application)
   */
  setupSPASupport() {
    if (!this.config.enableSPA) {
      logger.info('Soporte SPA deshabilitado');
      return;
    }

    try {
      const indexPath = path.join(this.config.publicPath, 'index.html');
      
      if (fs.existsSync(indexPath)) {
        // Middleware para manejar rutas SPA
        this.app.use((req, res, next) => {
          // Solo para GET requests
          if (req.method !== 'GET') {
            return next();
          }

          // Solo para rutas que no son API
          if (req.path.startsWith('/api') || req.path.startsWith('/public') || req.path.startsWith('/uploads')) {
            return next();
          }

          // Verificar si el archivo existe
          const filePath = path.join(this.config.publicPath, req.path);
          if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
            return next();
          }

          // Servir index.html para rutas SPA
          res.sendFile(indexPath);
        });

        logger.info(`📄 Soporte SPA configurado con: ${indexPath}`);
      } else {
        logger.warn(`📄 Archivo index.html no encontrado para SPA: ${indexPath}`);
      }

    } catch (error) {
      logger.error('Error configurando soporte SPA:', error);
      throw error;
    }
  }

  /**
   * Agregar ruta estática personalizada
   */
  addStaticRoute(route, directory, options = {}) {
    try {
      if (!fs.existsSync(directory)) {
        throw new Error(`Directorio no encontrado: ${directory}`);
      }

      const staticOptions = {
        maxAge: options.cacheControl || this.config.cacheControl,
        etag: options.etag !== false,
        lastModified: options.lastModified !== false,
        ...options
      };

      this.app.use(route, express.static(directory, staticOptions));
      this.servedPaths.push(directory);
      
      logger.info(`📁 Ruta estática personalizada agregada: ${route} -> ${directory}`);

    } catch (error) {
      logger.error(`Error agregando ruta estática ${route}:`, error);
      throw error;
    }
  }

  /**
   * Verificar integridad de archivos
   */
  checkFileIntegrity() {
    const results = {
      client: this.checkDirectory(this.config.clientPath),
      public: this.checkDirectory(this.config.publicPath),
      uploads: this.checkDirectory(this.config.uploadsPath)
    };

    logger.info('Verificación de integridad de archivos:', results);
    return results;
  }

  /**
   * Verificar directorio
   */
  checkDirectory(dirPath) {
    try {
      if (!fs.existsSync(dirPath)) {
        return { exists: false, files: 0, size: 0 };
      }

      const stats = this.getDirectoryStats(dirPath);
      return {
        exists: true,
        path: dirPath,
        ...stats
      };

    } catch (error) {
      logger.error(`Error verificando directorio ${dirPath}:`, error);
      return { exists: false, error: error.message };
    }
  }

  /**
   * Obtener estadísticas del directorio
   */
  getDirectoryStats(dirPath) {
    let files = 0;
    let size = 0;

    const traverse = (currentPath) => {
      const items = fs.readdirSync(currentPath);
      
      for (const item of items) {
        const itemPath = path.join(currentPath, item);
        const stat = fs.statSync(itemPath);
        
        if (stat.isDirectory()) {
          traverse(itemPath);
        } else {
          files++;
          size += stat.size;
        }
      }
    };

    traverse(dirPath);
    
    return { files, size };
  }

  /**
   * Obtener información del gestor
   */
  getInfo() {
    return {
      servedPaths: this.servedPaths,
      config: this.config,
      integrity: this.checkFileIntegrity()
    };
  }

  /**
   * Limpiar archivos temporales
   */
  cleanupTempFiles() {
    try {
      const tempPath = path.join(this.config.uploadsPath, 'temp');
      
      if (fs.existsSync(tempPath)) {
        const files = fs.readdirSync(tempPath);
        let cleaned = 0;
        
        for (const file of files) {
          const filePath = path.join(tempPath, file);
          const stat = fs.statSync(filePath);
          
          // Eliminar archivos más antiguos de 1 hora
          if (Date.now() - stat.mtime.getTime() > 3600000) {
            fs.unlinkSync(filePath);
            cleaned++;
          }
        }
        
        logger.info(`Archivos temporales limpiados: ${cleaned}`);
        return cleaned;
      }

    } catch (error) {
      logger.error('Error limpiando archivos temporales:', error);
    }
    
    return 0;
  }
}

export default StaticFileManager;
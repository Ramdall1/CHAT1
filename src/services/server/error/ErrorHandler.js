/**
 * @fileoverview Gestor de Manejo de Errores del Servidor
 * 
 * Módulo especializado para la configuración y gestión de errores
 * del servidor Express. Centraliza toda la lógica de manejo de errores.
 * 
 * @author ChatBot Enterprise Team
 * @version 1.0.0
 */

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createLogger } from '../../core/core/logger.js';

const logger = createLogger('ERROR_HANDLER');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Gestor de Manejo de Errores
 */
export class ErrorHandler {
  constructor(app, config = {}) {
    this.app = app;
    this.config = {
      environment: config.environment || process.env.NODE_ENV || 'development',
      enableNotFoundHandler: config.enableNotFoundHandler !== false,
      enableGlobalErrorHandler: config.enableGlobalErrorHandler !== false,
      enableSPAFallback: config.enableSPAFallback !== false,
      clientPath: config.clientPath || path.join(__dirname, '../../../../public'),
      logErrors: config.logErrors !== false,
      includeStackTrace: config.includeStackTrace !== false,
      ...config
    };
    
    this.errorStats = {
      total: 0,
      notFound: 0,
      serverErrors: 0,
      clientErrors: 0
    };
  }

  /**
   * Configurar todos los manejadores de errores
   */
  setupAll() {
    try {
      logger.info('Configurando manejadores de errores...');

      this.setupNotFoundHandler();
      this.setupGlobalErrorHandler();

      logger.info('Manejadores de errores configurados exitosamente');
      
    } catch (error) {
      logger.error('Error configurando manejadores de errores:', error);
      throw error;
    }
  }

  /**
   * Configurar manejador de rutas no encontradas (404)
   */
  setupNotFoundHandler() {
    if (!this.config.enableNotFoundHandler) {
      logger.info('Manejador de rutas no encontradas deshabilitado');
      return;
    }

    try {
      this.app.use((req, res, next) => {
        this.handleNotFound(req, res, next);
      });

      logger.info('Manejador de rutas no encontradas configurado');

    } catch (error) {
      logger.error('Error configurando manejador de rutas no encontradas:', error);
      throw error;
    }
  }

  /**
   * Configurar manejador global de errores
   */
  setupGlobalErrorHandler() {
    if (!this.config.enableGlobalErrorHandler) {
      logger.info('Manejador global de errores deshabilitado');
      return;
    }

    try {
      this.app.use((err, req, res, next) => {
        this.handleGlobalError(err, req, res, next);
      });

      logger.info('Manejador global de errores configurado');

    } catch (error) {
      logger.error('Error configurando manejador global de errores:', error);
      throw error;
    }
  }

  /**
   * Manejar rutas no encontradas
   */
  handleNotFound(req, res, next) {
    try {
      this.errorStats.notFound++;
      this.errorStats.total++;

      if (this.config.logErrors) {
        logger.warn(`Ruta no encontrada: ${req.method} ${req.path}`, {
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          referer: req.get('Referer')
        });
      }

      // Para rutas API, devolver JSON
      if (req.path.startsWith('/api')) {
        return res.status(404).json({
          success: false,
          error: 'Endpoint no encontrado',
          path: req.path,
          method: req.method,
          timestamp: new Date().toISOString()
        });
      }

      // Para rutas no-API, intentar SPA fallback
      if (this.config.enableSPAFallback) {
        const indexPath = path.join(this.config.clientPath, 'index.html');
        
        if (fs.existsSync(indexPath)) {
          return res.sendFile(indexPath);
        }
      }

      // Fallback final
      res.status(404).send(this.generateNotFoundPage(req));

    } catch (error) {
      logger.error('Error en manejador de rutas no encontradas:', error);
      next(error);
    }
  }

  /**
   * Manejar errores globales
   */
  handleGlobalError(err, req, res, next) {
    try {
      this.errorStats.total++;
      
      // Clasificar error
      const statusCode = err.statusCode || err.status || 500;
      if (statusCode >= 400 && statusCode < 500) {
        this.errorStats.clientErrors++;
      } else {
        this.errorStats.serverErrors++;
      }

      // Logging del error
      if (this.config.logErrors) {
        logger.error('Error no manejado:', {
          error: err.message,
          stack: err.stack,
          url: req.url,
          method: req.method,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          statusCode: statusCode
        });
      }

      // No enviar respuesta si ya se enviaron headers
      if (res.headersSent) {
        return next(err);
      }

      // Preparar respuesta de error
      const errorResponse = this.buildErrorResponse(err, req);
      
      res.status(statusCode).json(errorResponse);

    } catch (handlerError) {
      logger.error('Error en manejador global de errores:', handlerError);
      
      // Último recurso
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          error: 'Error interno crítico del servidor',
          timestamp: new Date().toISOString()
        });
      }
    }
  }

  /**
   * Construir respuesta de error
   */
  buildErrorResponse(err, req) {
    const isDevelopment = this.config.environment === 'development';
    
    const baseResponse = {
      success: false,
      error: isDevelopment ? err.message : 'Error interno del servidor',
      timestamp: new Date().toISOString(),
      path: req.path,
      method: req.method
    };

    // Agregar información adicional en desarrollo
    if (isDevelopment && this.config.includeStackTrace) {
      baseResponse.stack = err.stack;
      baseResponse.details = {
        name: err.name,
        code: err.code,
        statusCode: err.statusCode || err.status
      };
    }

    // Agregar información específica del error
    if (err.code) {
      baseResponse.code = err.code;
    }

    if (err.validation) {
      baseResponse.validation = err.validation;
    }

    return baseResponse;
  }

  /**
   * Generar página de error 404
   */
  generateNotFoundPage(req) {
    return `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Página No Encontrada - ChatBot</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            margin: 0;
            padding: 0;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
        }
        .container {
            text-align: center;
            padding: 2rem;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 20px;
            backdrop-filter: blur(10px);
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
        }
        h1 {
            font-size: 6rem;
            margin: 0;
            font-weight: 300;
        }
        h2 {
            font-size: 2rem;
            margin: 1rem 0;
            font-weight: 400;
        }
        p {
            font-size: 1.2rem;
            margin: 1rem 0;
            opacity: 0.9;
        }
        .btn {
            display: inline-block;
            padding: 12px 24px;
            background: rgba(255, 255, 255, 0.2);
            color: white;
            text-decoration: none;
            border-radius: 8px;
            margin-top: 2rem;
            transition: all 0.3s ease;
        }
        .btn:hover {
            background: rgba(255, 255, 255, 0.3);
            transform: translateY(-2px);
        }
        .details {
            margin-top: 2rem;
            font-size: 0.9rem;
            opacity: 0.7;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>404</h1>
        <h2>Página No Encontrada</h2>
        <p>La página que buscas no existe o ha sido movida.</p>
        <a href="/" class="btn">Volver al Inicio</a>
        <div class="details">
            <p>Ruta solicitada: ${req.path}</p>
            <p>Método: ${req.method}</p>
            <p>Timestamp: ${new Date().toISOString()}</p>
        </div>
    </div>
</body>
</html>
    `;
  }

  /**
   * Crear manejador de error personalizado
   */
  createCustomErrorHandler(name, handler) {
    try {
      this.app.use((err, req, res, next) => {
        // Solo procesar si es el tipo de error específico
        if (err.type === name || err.name === name) {
          return handler(err, req, res, next);
        }
        next(err);
      });

      logger.info(`Manejador de error personalizado creado: ${name}`);

    } catch (error) {
      logger.error(`Error creando manejador personalizado ${name}:`, error);
      throw error;
    }
  }

  /**
   * Obtener estadísticas de errores
   */
  getErrorStats() {
    return {
      ...this.errorStats,
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Resetear estadísticas de errores
   */
  resetErrorStats() {
    this.errorStats = {
      total: 0,
      notFound: 0,
      serverErrors: 0,
      clientErrors: 0
    };
    
    logger.info('Estadísticas de errores reseteadas');
  }

  /**
   * Obtener información del manejador
   */
  getInfo() {
    return {
      config: this.config,
      stats: this.getErrorStats()
    };
  }

  /**
   * Validar configuración
   */
  validateConfig() {
    const required = ['environment'];
    const missing = required.filter(key => !this.config[key]);
    
    if (missing.length > 0) {
      logger.warn(`Configuración faltante: ${missing.join(', ')}`);
      return false;
    }

    return true;
  }
}

export default ErrorHandler;
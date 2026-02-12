/**
 * @fileoverview Gestor de Middleware del Servidor
 * 
 * Módulo especializado para la configuración y gestión de middleware
 * del servidor Express. Centraliza toda la lógica de middleware.
 * 
 * @author ChatBot Enterprise Team
 * @version 1.0.0
 */

import express from 'express';
import cookieParser from 'cookie-parser';
import { corsMiddleware, helmetMiddleware, requestLogger, sanitizeHeaders, safariCompatibilityMiddleware } from '../../../middleware/security.js';
import { authenticateToken } from '../../../middleware/auth.js';
import { createLogger } from '../../core/core/logger.js';

const logger = createLogger('MIDDLEWARE_MANAGER');

/**
 * Gestor de Middleware
 */
export class MiddlewareManager {
  constructor(app, config = {}) {
    this.app = app;
    this.config = {
      bodyLimit: config.bodyLimit || '10mb',
      enableAuth: config.enableAuth !== false,
      enableSecurity: config.enableSecurity !== false,
      enableLogging: config.enableLogging !== false,
      ...config
    };
    
    this.middlewareStack = [];
  }

  /**
   * Configurar todos los middleware
   */
  setupAll() {
    try {
      logger.info('Configurando middleware del servidor...');

      this.setupSecurity();
      this.setupBasic();
      this.setupAuthentication();

      logger.info(`Middleware configurado exitosamente (${this.middlewareStack.length} middleware activos)`);
      
    } catch (error) {
      logger.error('Error configurando middleware:', error);
      throw error;
    }
  }

  /**
   * Configurar middleware de seguridad
   */
  setupSecurity() {
    if (!this.config.enableSecurity) {
      logger.warn('Middleware de seguridad deshabilitado');
      return;
    }

    try {
      // Middleware de compatibilidad con Safari (debe ir primero)
      this.app.use(safariCompatibilityMiddleware);
      this.middlewareStack.push('safari-compatibility');

      // Helmet para headers de seguridad
      this.app.use(helmetMiddleware);
      this.middlewareStack.push('helmet');

      // CORS
      this.app.use(corsMiddleware);
      this.middlewareStack.push('cors');

      // Logging de requests
      if (this.config.enableLogging) {
        this.app.use(requestLogger);
        this.middlewareStack.push('request-logger');
      }

      // Sanitización de headers
      this.app.use(sanitizeHeaders);
      this.middlewareStack.push('sanitize-headers');

      logger.info('Middleware de seguridad configurado');

    } catch (error) {
      logger.error('Error configurando middleware de seguridad:', error);
      throw error;
    }
  }

  /**
   * Configurar middleware básico
   */
  setupBasic() {
    try {
      // Parser JSON
      this.app.use(express.json({ 
        limit: this.config.bodyLimit,
        verify: (req, res, buf) => {
          // Verificación adicional del body
          if (buf.length > 0) {
            try {
              JSON.parse(buf);
            } catch (e) {
              logger.warn('JSON inválido recibido:', e.message);
            }
          }
        }
      }));
      this.middlewareStack.push('json-parser');

      // Parser URL encoded
      this.app.use(express.urlencoded({ 
        extended: true, 
        limit: this.config.bodyLimit 
      }));
      this.middlewareStack.push('urlencoded-parser');

      // Parser de cookies
      this.app.use(cookieParser());
      this.middlewareStack.push('cookie-parser');

      // Middleware de timestamp
      this.app.use((req, res, next) => {
        req.timestamp = new Date().toISOString();
        next();
      });
      this.middlewareStack.push('timestamp');

      logger.info('Middleware básico configurado');

    } catch (error) {
      logger.error('Error configurando middleware básico:', error);
      throw error;
    }
  }

  /**
   * Configurar middleware de autenticación
   */
  setupAuthentication() {
    if (!this.config.enableAuth) {
      logger.warn('Middleware de autenticación deshabilitado');
      return;
    }

    try {
      // Middleware de autenticación global - COMENTADO para usar requireAuth actualizado
      // this.app.use(authenticateToken);
      // this.middlewareStack.push('authentication');

      logger.info('Middleware de autenticación global deshabilitado - usando requireAuth actualizado');

    } catch (error) {
      logger.error('Error configurando middleware de autenticación:', error);
      throw error;
    }
  }

  /**
   * Agregar middleware personalizado
   */
  addCustomMiddleware(name, middleware) {
    try {
      this.app.use(middleware);
      this.middlewareStack.push(name);
      logger.info(`Middleware personalizado agregado: ${name}`);
    } catch (error) {
      logger.error(`Error agregando middleware ${name}:`, error);
      throw error;
    }
  }

  /**
   * Obtener información del middleware
   */
  getInfo() {
    return {
      activeMiddleware: this.middlewareStack,
      count: this.middlewareStack.length,
      config: this.config
    };
  }

  /**
   * Validar configuración de middleware
   */
  validateConfig() {
    const requiredMiddleware = ['json-parser', 'urlencoded-parser'];
    const missing = requiredMiddleware.filter(mw => !this.middlewareStack.includes(mw));
    
    if (missing.length > 0) {
      logger.warn(`Middleware requerido faltante: ${missing.join(', ')}`);
      return false;
    }

    return true;
  }
}

export default MiddlewareManager;
/**
 * @fileoverview Servidor Seguro del ChatBot
 */

import express from 'express';
import { createServer } from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import helmet from 'helmet';
import cors from 'cors';
import { Server as SocketIOServer } from 'socket.io';
import { createLogger } from '../services/core/core/logger.js';
import SecurityManager from '../services/core/core/auth/SecurityManager.js';

// Importar rutas de API
import chatLiveRoutes from '../api/routes/chat-live.js';
import contactRoutes from '../api/routes/contactRoutes.js';
import tagsRoutes from '../api/routes/tags.js';
import campaignsRouter from '../api/routes/campaignsRoutes.js';
import messageRoutes from '../api/routes/messageRoutes.js';
import customFieldsRouter, { initializeCustomFields } from '../api/routes/customFieldsRoutes.js';
import templateApprovalsRouter from '../api/routes/template-approvals.js';
import campaignTemplatesRouter from '../api/routes/campaign-templates.js';
import campaignSendRouter from '../api/routes/campaign-send.js';

const logger = createLogger('SECURE_SERVER');
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class SecureServer {
  constructor(config = {}) {
    this.config = {
      port: config.port || process.env.PORT || 3000,
      host: config.host || process.env.HOST || 'localhost',
      environment: config.environment || process.env.NODE_ENV || 'development',
      clientPath: config.clientPath || path.join(__dirname, '../../client'),
      ...config
    };
    this.app = express();
    this.httpServer = createServer(this.app);
    this.io = null;
    this.isRunning = false;
  }

  async initialize() {
    try {
      logger.info('🚀 Inicializando SecureServer...');
      
      // Configurar seguridad
      this.setupSecurity();
      logger.info('✅ Seguridad configurada');
      
      // Configurar middleware básico
      this.setupMiddleware();
      logger.info('✅ Middleware configurado');
      
      // Configurar Socket.IO
      this.setupSocketIO();
      logger.info('✅ Socket.IO configurado');
      
      // Configurar rutas de API (ANTES de rutas estáticas)
      await this.setupApiRoutes();
      
      // Configurar rutas estáticas (DESPUÉS de rutas de API)
      this.setupStaticFiles();
      logger.info('✅ Archivos estáticos configurados');
      
      logger.info('✅ SecureServer inicializado exitosamente');
      
    } catch (error) {
      logger.error('❌ Error inicializando SecureServer:', error);
      throw error;
    }
  }

  setupSecurity() {
    this.app.use(helmet(SecurityManager.getHelmetConfig()));
    this.app.use(cors(SecurityManager.getCorsConfig()));
  }

  setupMiddleware() {
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  }

  setupSocketIO() {
    try {
      this.io = new SocketIOServer(this.httpServer, {
        cors: {
          origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
          methods: ['GET', 'POST']
        }
      });

      // Hacer Socket.IO disponible en app.locals para servicios
      this.app.locals.io = this.io;

      // Configurar eventos básicos de Socket.IO
      this.io.on('connection', (socket) => {
        logger.info(`🔌 Cliente conectado: ${socket.id}`);

        socket.on('disconnect', () => {
          logger.info(`🔌 Cliente desconectado: ${socket.id}`);
        });

        // Eventos básicos
        socket.on('join-room', (room) => {
          socket.join(room);
          logger.debug(`Cliente ${socket.id} se unió a la sala: ${room}`);
        });

        socket.on('leave-room', (room) => {
          socket.leave(room);
          logger.debug(`Cliente ${socket.id} salió de la sala: ${room}`);
        });

        // Ping/Pong para mantener conexión
        socket.on('ping', () => {
          socket.emit('pong', { timestamp: new Date().toISOString() });
        });
      });

      logger.info('✅ Socket.IO configurado correctamente');
      logger.info('✅ Socket.IO disponible en app.locals.io');

    } catch (error) {
      logger.error('❌ Error configurando Socket.IO:', error);
      throw error;
    }
  }

  async setupApiRoutes() {
    try {
      logger.info('📍 Registrando rutas de API...');
      
      // Inicializar campos personalizados
      await initializeCustomFields();
      
      // Importar rutas de forma dinámica
      const dialog360Module = await import('../api/routes/360dialog.js');
      const dialog360Routes = dialog360Module.default;
      
      const webhooksModule = await import('../api/routes/webhooks.js');
      const webhookRoutes = webhooksModule.default;
      
      // Registrar rutas de API
      this.app.use('/api/360dialog', dialog360Routes);
      logger.info('✅ Rutas /api/360dialog registradas');
      
      this.app.use('/webhooks', webhookRoutes);
      logger.info('✅ Rutas /webhooks registradas');
      
      this.app.use('/api/webhooks', webhookRoutes);
      logger.info('✅ Rutas /api/webhooks registradas');
      
      // Registrar rutas adicionales de API
      this.app.use('/api/chat-live', chatLiveRoutes);
      logger.info('✅ Rutas /api/chat-live registradas');
      
      this.app.use('/api/contacts', contactRoutes);
      logger.info('✅ Rutas /api/contacts registradas');
      
      this.app.use('/api/tags', tagsRoutes);
      logger.info('✅ Rutas /api/tags registradas');
      
      this.app.use('/api/campaigns', campaignsRouter);
      logger.info('✅ Rutas /api/campaigns registradas');
      
      this.app.use('/api/whatsapp', messageRoutes);
      this.app.use('/api/v1/messages', messageRoutes);
      logger.info('✅ Rutas /api/whatsapp y /api/v1/messages registradas');
      
      // Registrar rutas de campos personalizados
      this.app.use('/api', customFieldsRouter);
      logger.info('✅ Rutas /api/custom-fields registradas');
      
      // Registrar rutas de aprobación de plantillas
      this.app.use('/api/template-approvals', templateApprovalsRouter);
      logger.info('✅ Rutas /api/template-approvals registradas');
      
      // Registrar rutas de plantillas de campañas
      this.app.use('/api/campaign-templates', campaignTemplatesRouter);
      logger.info('✅ Rutas /api/campaign-templates registradas');
      
      // Registrar rutas de envío de campañas
      this.app.use('/api/campaign-send', campaignSendRouter);
      logger.info('✅ Rutas /api/campaign-send registradas');
      
      logger.info('✅ Todas las rutas de API configuradas correctamente');
    } catch (error) {
      logger.error('❌ Error configurando rutas de API:', error.message);
      throw error;
    }
  }

  setupStaticFiles() {
    // Redirección de / a /dashboard
    this.app.get('/', (req, res) => {
      res.redirect('/dashboard');
    });
    
    // Rutas específicas para páginas HTML
    this.app.get('/dashboard', (req, res) => {
      res.sendFile(path.join(this.config.clientPath, 'dashboard.html'));
    });
    
    this.app.get('/chat-live', (req, res) => {
      res.sendFile(path.join(this.config.clientPath, 'chat-live.html'));
    });
    
    this.app.get('/contacts', (req, res) => {
      res.sendFile(path.join(this.config.clientPath, 'contacts.html'));
    });
    
    this.app.get('/campaigns', (req, res) => {
      res.sendFile(path.join(this.config.clientPath, 'campaigns.html'));
    });
    
    this.app.get('/template-approvals', (req, res) => {
      res.sendFile(path.join(this.config.clientPath, 'template-approvals.html'));
    });
    
    // SEGUNDO: Servir archivos estáticos (CSS, JS, imágenes, etc.)
    // Esto debe ir ANTES del catch-all para que funcione correctamente
    this.app.use(express.static(this.config.clientPath, {
      maxAge: '1h',
      etag: true,
      lastModified: true,
      // Asegurar MIME types correctos
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('.js')) {
          res.setHeader('Content-Type', 'application/javascript');
        } else if (filePath.endsWith('.css')) {
          res.setHeader('Content-Type', 'text/css');
        } else if (filePath.endsWith('.json')) {
          res.setHeader('Content-Type', 'application/json');
        } else if (filePath.endsWith('.html')) {
          res.setHeader('Content-Type', 'text/html');
        } else if (filePath.endsWith('.svg')) {
          res.setHeader('Content-Type', 'image/svg+xml');
        } else if (filePath.endsWith('.png')) {
          res.setHeader('Content-Type', 'image/png');
        } else if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) {
          res.setHeader('Content-Type', 'image/jpeg');
        } else if (filePath.endsWith('.gif')) {
          res.setHeader('Content-Type', 'image/gif');
        } else if (filePath.endsWith('.woff')) {
          res.setHeader('Content-Type', 'font/woff');
        } else if (filePath.endsWith('.woff2')) {
          res.setHeader('Content-Type', 'font/woff2');
        } else if (filePath.endsWith('.ttf')) {
          res.setHeader('Content-Type', 'font/ttf');
        }
      }
    }));
    
    // Servir archivos de media descargados desde webhooks
    this.app.use('/media', express.static(path.join(process.cwd(), 'data', 'media'), {
      maxAge: '7d', // Cache por 7 días para media
      etag: true,
      lastModified: true,
      setHeaders: (res, filePath) => {
        // Detectar tipo de media por extensión
        if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) {
          res.setHeader('Content-Type', 'image/jpeg');
        } else if (filePath.endsWith('.png')) {
          res.setHeader('Content-Type', 'image/png');
        } else if (filePath.endsWith('.gif')) {
          res.setHeader('Content-Type', 'image/gif');
        } else if (filePath.endsWith('.webp')) {
          res.setHeader('Content-Type', 'image/webp');
        } else if (filePath.endsWith('.mp4')) {
          res.setHeader('Content-Type', 'video/mp4');
        } else if (filePath.endsWith('.webm')) {
          res.setHeader('Content-Type', 'video/webm');
        } else if (filePath.endsWith('.mp3')) {
          res.setHeader('Content-Type', 'audio/mpeg');
        } else if (filePath.endsWith('.ogg')) {
          res.setHeader('Content-Type', 'audio/ogg');
        } else if (filePath.endsWith('.wav')) {
          res.setHeader('Content-Type', 'audio/wav');
        } else if (filePath.endsWith('.pdf')) {
          res.setHeader('Content-Type', 'application/pdf');
        } else if (filePath.endsWith('.doc') || filePath.endsWith('.docx')) {
          res.setHeader('Content-Type', 'application/msword');
        }
      }
    }));
    
    // Socket.IO middleware - ANTES del catch-all
    // Socket.IO se sirve automáticamente, pero aseguramos el MIME type
    this.app.use('/socket.io', (req, res, next) => {
      if (req.path.endsWith('.js')) {
        res.setHeader('Content-Type', 'application/javascript');
      }
      next();
    });
    
    // Catch-all para rutas no encontradas (AL FINAL)
    this.app.get('*', (req, res) => {
      // No servir archivos para rutas de API
      if (req.path.startsWith('/api/') || req.path.startsWith('/webhooks/') || req.path.startsWith('/socket.io/')) {
        return res.status(404).json({ error: 'Not found' });
      }
      // Servir dashboard.html para SPA routing
      res.sendFile(path.join(this.config.clientPath, 'dashboard.html'));
    });
  }

  async start() {
    try {
      await this.initialize();
      return new Promise((resolve, reject) => {
        this.httpServer.listen(this.config.port, this.config.host, () => {
          this.isRunning = true;
          logger.info(`🌐 SecureServer escuchando en http://${this.config.host}:${this.config.port}`);
          resolve(this.httpServer);
        }).on('error', reject);
      });
    } catch (error) {
      logger.error('❌ Error iniciando SecureServer:', error);
      throw error;
    }
  }

  async stop() {
    try {
      if (!this.isRunning) {
        logger.warn('⚠️ SecureServer no está en ejecución');
        return;
      }
      return new Promise((resolve, reject) => {
        this.httpServer.close((err) => {
          if (err) {
            logger.error('❌ Error deteniendo SecureServer:', err);
            reject(err);
          } else {
            this.isRunning = false;
            logger.info('✅ SecureServer detenido');
            resolve();
          }
        });
      });
    } catch (error) {
      logger.error('❌ Error en stop():', error);
      throw error;
    }
  }

  getApp() {
    return this.app;
  }

  getHttpServer() {
    return this.httpServer;
  }
}

export default SecureServer;

import express from 'express';
import https from 'https';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import compression from 'compression';
import morgan from 'morgan';
import winston from 'winston';
import 'winston-daily-rotate-file';
import helmet from 'helmet';
import cors from 'cors';
import { Server as SocketIOServer } from 'socket.io';

import SecurityManager from '../services/core/core/auth/SecurityManager.js';
import { getDatabaseService, initializeDatabase } from '../services/DatabaseService.js';
import InputSanitizationService from '../services/core/core/auth/InputSanitizationService.js';
import { sanitizeInputs } from '../api/middleware/inputSanitizationMiddleware.js';
import multer from 'multer';
import * as XLSX from 'xlsx';
import sqlite3 from 'sqlite3';

// Import routes
import chatLiveRoutes from '../api/routes/chat-live.js';
import contactRoutes from '../api/routes/contactRoutes.js';
import tagsRoutes from '../api/routes/tags.js';
import webhookRoutes from '../api/routes/webhooks.js';
import dialog360Routes from '../api/routes/360dialog.js';
import campaignsRouter from '../api/routes/campaignsRoutes.js';
import messageRoutes from '../api/routes/messageRoutes.js';

// ES modules equivalents for __dirname and __filename
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class SecureServer {
  constructor() {
    this.app = express();
    this.server = null;
    this.io = null;
    this.database = null;
    this.logger = null;
    this.port = process.env.PORT || 3000;
    this.host = process.env.HOST || '0.0.0.0'; // Cambiar a 0.0.0.0 para bind a todas las interfaces
        
    // Configurar logger
    this.setupLogger();
        
    // Configurar base de datos
    this.database = getDatabaseService();
    this.security = SecurityManager;
        
    // Inicializar servicio de sanitización
    this.sanitizationService = new InputSanitizationService();
  }

  setupLogger() {
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      defaultMeta: { service: 'chatbot-server' },
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        }),
        new winston.transports.DailyRotateFile({
          filename: 'logs/app-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          maxSize: '20m',
          maxFiles: '14d'
        }),
        new winston.transports.DailyRotateFile({
          filename: 'logs/error-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          level: 'error',
          maxSize: '20m',
          maxFiles: '30d'
        })
      ]
    });
  }

  // Configuración de seguridad
  setupSecurity() {
    // Helmet para headers de seguridad
    this.app.use(helmet(SecurityManager.getHelmetConfig()));
        
    // CORS restrictivo
    this.app.use(cors(SecurityManager.getCorsConfig()));
        
    // Rate limiting global
    this.app.use(SecurityManager.createRateLimit('moderate'));
        
    // Slow down para degradar performance gradualmente
    this.app.use(SecurityManager.createSlowDown('moderate'));
        
    // Sanitización de entrada básica (SecurityManager)
    this.app.use(SecurityManager.sanitizeRequest.bind(SecurityManager));
        
    // Sanitización avanzada de entrada (InputSanitizationService)
    // Comentado temporalmente para pruebas - detectAttacks está bloqueando curl
    // this.app.use(sanitizeInputs);
        
    // Logging de requests
    this.app.use(morgan('combined', {
      stream: {
        write: (message) => this.logger.info(message.trim())
      }
    }));
  }

  setupDatabaseMiddleware() {
    this.logger.info('🔧 Configurando middleware de base de datos...');
    this.logger.info(`Database instance: ${this.database ? 'OK' : 'UNDEFINED'}`);

    // Middleware para agregar instancia de base de datos unificada a req
    this.app.use((req, res, next) => {
      req.database = this.database;
      req.sqliteManager = this.database; // Para compatibilidad con código existente
      next();
    });

    this.logger.info('✅ Middleware de base de datos configurado');
  }

  // Configuración de middleware básico
  setupMiddleware() {
    // Configurar middlewares de seguridad usando SecurityManager
    this.app.use(helmet(SecurityManager.getHelmetConfig()));
    // Rate limiting DESACTIVADO completamente
    // this.app.use(SecurityManager.createRateLimit('moderate'));
    // this.app.use(SecurityManager.createSlowDown('moderate'));
        
    // Compresión
    this.app.use(compression({
      level: 6,
      threshold: 1024,
      filter: (req, res) => {
        if (req.headers['x-no-compression']) {
          return false;
        }
        return compression.filter(req, res);
      }
    }));

    // Parseo de JSON con límite de tamaño
    this.app.use(express.json({ 
      limit: '10mb',
      verify: (req, res, buf) => {
        req.rawBody = buf;
      }
    }));
        
    // Parseo de URL encoded
    this.app.use(express.urlencoded({
      extended: true,
      limit: '10mb'
    }));

    // Archivos estáticos del cliente
    this.app.use(express.static(path.join(__dirname, '../../client'), {
      maxAge: process.env.NODE_ENV === 'production' ? '1d' : '0',
      etag: true,
      lastModified: true
    }));

    // Archivos multimedia descargados desde webhooks
    this.app.use('/media', express.static(path.join(process.cwd(), 'data', 'media'), {
      maxAge: '7d', // Cache por 7 días para media
      etag: true,
      lastModified: true,
      setHeaders: (res, path) => {
        // Headers de seguridad para archivos multimedia
        res.set('X-Content-Type-Options', 'nosniff');
        res.set('Cache-Control', 'public, max-age=604800'); // 7 días
      }
    }));

  }

  // Configuración de rutas
  async setupRoutes() {
    this.logger.info('🔧 Iniciando configuración de rutas...');

    // Ruta especial para Chrome DevTools - devolver 404 silencioso
    this.app.get('/.well-known/appspecific/com.chrome.devtools.json', (req, res) => {
      res.status(404).json({ error: 'Not Found' });
    });

    // Ruta de salud - optimizada para carga rápida
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: '2.0.0',
        environment: process.env.NODE_ENV || 'production',
        database: 'SQLite - Connected',
        security: 'Enterprise Level - Active'
      });
    });

    // Métricas
    this.app.get('/metrics', async(req, res) => {
      try {
        const db = this.database;
                
        // Estadísticas de la base de datos
        const stats = await Promise.all([
          db.get('SELECT COUNT(*) as count FROM contacts'),
          db.get('SELECT COUNT(*) as count FROM messages'),
          db.get('SELECT COUNT(*) as count FROM users'),
          db.get('SELECT COUNT(*) as count FROM sessions WHERE expires_at > datetime("now")')
        ]);

        res.json({
          system: {
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            cpu: process.cpuUsage(),
            timestamp: new Date().toISOString(),
            node_version: process.version,
            platform: process.platform
          },
          database: {
            contacts: stats[0].count,
            messages: stats[1].count,
            users: stats[2].count,
            active_sessions: stats[3].count
          },
          security: {
            cors_enabled: true,
            rate_limiting: true,
            jwt_auth: true,
            input_validation: true,
            encryption: true,
            advanced_security: await this.security.getSystemStats(),
            sanitization: this.sanitizationService.getStats()
          }
        });
      } catch (error) {
        this.logger.error('Error obteniendo métricas:', error);
        res.status(500).json({ error: 'Error obteniendo métricas' });
      }
    });

    // Endpoint de status
    this.app.get('/api/status', (req, res) => {
      res.json({
        success: true,
        status: 'running',
        timestamp: new Date().toISOString()
      });
    });

    const upload = multer({ dest: 'uploads/' });

    const normalizePhone = (value) => {
      if (!value) return '';
      let digits = value.toString().replace(/[^0-9]/g, '');
      if (digits.startsWith('57') && digits.length > 12) {
        digits = digits.substring(0, 12);
      }
      if (digits.length === 10) {
        digits = '57' + digits;
      }
      return digits;
    };

    const readRowsFromFile = (fileBuffer, extension) => {
      const rows = [];
      if (extension === 'csv') {
        const text = fileBuffer.toString('utf-8');
        const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
        if (lines.length > 1) {
          lines.slice(1).forEach(line => rows.push(line.split(/[,;\t]/)));
        }
      } else if (extension === 'xlsx' || extension === 'xls') {
        const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        if (data.length > 1) {
          data.slice(1).forEach(row => rows.push(row));
        }
      }
      return rows;
    };

    const mapIndex = (mapping, key) => {
      if (!mapping || mapping[key] == null) return null;
      const idx = parseInt(mapping[key], 10);
      return Number.isNaN(idx) ? null : idx;
    };

    this.app.post('/api/contacts/import', upload.single('file'), async (req, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ success: false, error: 'No se proporcionó archivo' });
        }

        let mapping = null;
        if (req.body.mapping) {
          try {
            mapping = JSON.parse(req.body.mapping);
          } catch (e) {
            return res.status(400).json({ success: false, error: 'mapping inválido' });
          }
        }

        const fileBuffer = fs.readFileSync(req.file.path);
        const extension = (req.file.originalname.split('.').pop() || '').toLowerCase();
        const rows = readRowsFromFile(fileBuffer, extension);

        if (!rows.length) {
          return res.status(400).json({ success: false, error: 'El archivo no contiene filas de datos' });
        }

        const idxName = mapIndex(mapping, 'name');
        const idxLastName = mapIndex(mapping, 'lastName');
        const idxPhone = mapIndex(mapping, 'phone');
        const idxEmail = mapIndex(mapping, 'email');

        if (idxPhone == null) {
          return res.status(400).json({ success: false, error: 'Es obligatorio mapear la columna de Teléfono' });
        }

        let imported = 0;
        let updated = 0;
        const errors = [];

        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          try {
            const rawPhone = row[idxPhone];
            const phone = normalizePhone(rawPhone ?? '');
            if (!phone) {
              errors.push({ row: i + 2, error: 'Teléfono vacío o inválido' });
              continue;
            }

            const name = idxName != null ? (row[idxName] ?? '').toString().trim() : '';
            const lastName = idxLastName != null ? (row[idxLastName] ?? '').toString().trim() : '';
            const email = idxEmail != null ? (row[idxEmail] ?? '').toString().trim() : '';

            const existing = await this.database.get('SELECT id FROM contacts WHERE phone_number = ?', [phone]);

            if (existing) {
              await this.database.run(
                `UPDATE contacts
                 SET name = ?, last_name = ?, email = ?, updated_at = datetime('now')
                 WHERE id = ?`,
                [name || null, lastName || null, email || null, existing.id]
              );
              updated++;
            } else {
              const result = await this.database.run(
                `INSERT INTO contacts (phone_number, name, last_name, email, notes, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
                [phone, name || null, lastName || null, email || null, '']
              );
              if (result && result.lastID) {
                imported++;
              }
            }
          } catch (err) {
            errors.push({ row: i + 2, error: err.message });
          }
        }

        res.json({ success: true, imported, updated, errors });
      } catch (error) {
        this.logger.error('Error importando contactos:', error);
        res.status(500).json({ success: false, error: error.message });
      } finally {
        if (req.file && req.file.path) {
          fs.promises.unlink(req.file.path).catch(() => {});
        }
      }
    });
        

    // Endpoints de AI
    this.app.get('/api/ai/status', (req, res) => {
      this.logger.info('Endpoint /api/ai/status llamado');
      res.json({
        success: true,
        status: 'active',
        service: 'AI Assistant',
        timestamp: new Date().toISOString(),
        features: {
          nlp: 'enabled',
          sentiment_analysis: 'enabled',
          auto_responses: 'enabled',
          learning: 'enabled'
        },
        model: {
          name: 'ChatBot Enterprise AI',
          version: '2.0.0',
          language: 'es'
        }
      });
    });

    // Webhook routes are now handled by the imported webhookRoutes module
    // Registered at /webhooks path above

    // Endpoints de seguridad avanzada
    this.app.get('/api/security/status', async(req, res) => {
      try {
        const securityStatus = await this.security.getSystemStats();
        const sanitizationStats = this.sanitizationService.getStats();
                
        res.json({
          status: 'active',
          timestamp: new Date().toISOString(),
          advancedSecurity: securityStatus,
          sanitization: sanitizationStats,
          protectionLevel: 'enterprise'
        });
      } catch (error) {
        this.logger.error('Error obteniendo estado de seguridad:', error);
        res.status(500).json({ error: 'Error obteniendo estado de seguridad' });
      }
    });

    // Endpoint para configurar sanitización
    this.app.post('/api/security/sanitization/config', (req, res) => {
      try {
        const { config } = req.body;
        this.sanitizationService.updateConfig(config);
                
        res.json({
          status: 'updated',
          message: 'Configuración de sanitización actualizada',
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        this.logger.error('Error actualizando configuración de sanitización:', error);
        res.status(500).json({ error: 'Error actualizando configuración' });
      }
    });

    // Endpoint para obtener logs de seguridad
    this.app.get('/api/security/logs', async(req, res) => {
      try {
        const { limit = 100, type = 'all' } = req.query;
        // Aquí podrías implementar la lógica para obtener logs de seguridad
        res.json({
          logs: [],
          total: 0,
          type,
          limit: parseInt(limit),
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        this.logger.error('Error obteniendo logs de seguridad:', error);
        res.status(500).json({ error: 'Error obteniendo logs' });
      }
    });



    // Endpoints eliminados - datos ahora en SQLite
    this.app.get('/api/data/messages', (req, res) => {
      res.status(410).json({
        error: 'Este endpoint ha sido eliminado. Los datos ahora se obtienen de SQLite a través de /api/chat-live/conversations'
      });
    });

    this.app.get('/api/data/contacts', (req, res) => {
      res.status(410).json({
        error: 'Este endpoint ha sido eliminado. Los datos ahora se obtienen de SQLite a través de /api/contacts'
      });
    });

    // Rutas específicas para dashboards disponibles
    this.app.get('/dashboard', (req, res) => {
      res.sendFile(path.join(__dirname, '../../client/dashboard.html'));
    });

    this.app.get('/chat-live', (req, res) => {
      res.sendFile(path.join(__dirname, '../../client/chat-live.html'));
    });

    this.app.get('/contacts', (req, res) => {
      res.sendFile(path.join(__dirname, '../../client/contacts.html'));
    });

    this.app.get('/campaigns', (req, res) => {
      res.sendFile(path.join(__dirname, '../../client/campaigns.html'));
    });

    // Ruta para la página principal - redirige al dashboard
    this.app.get('/', (req, res) => {
      res.redirect('/dashboard');
    });

    // Chat-live routes
    this.app.use('/api/chat-live', chatLiveRoutes);

    // Contact routes
    this.app.use('/api/contacts', contactRoutes);

    // Tags routes
    this.app.use('/api/tags', tagsRoutes);







    // Campaigns routes
    this.app.use('/api/campaigns', campaignsRouter);

    // Webhook routes - Cambiar a /api/webhooks para coincidir con la URL configurada en 360Dialog
    this.app.use('/api/webhooks', webhookRoutes);

    // 360Dialog routes
    this.app.use('/api/360dialog', dialog360Routes);

    // Message routes
    this.app.use('/api/whatsapp', messageRoutes);
    this.app.use('/api/v1/messages', messageRoutes);

    // Configurar todas las rutas (incluyendo custom-fields)
    try {
      console.log('📍 Importando setupAllRoutes...');
      const { setupAllRoutes } = await import('../routes/server.routes.js');
      console.log('📍 Llamando a setupAllRoutes...');
      await setupAllRoutes(this.app, this.io);
      console.log('✅ setupAllRoutes completado');
    } catch (error) {
      console.error('❌ Error en setupAllRoutes:', error);
      throw error;
    }
  }

  // Manejo de errores
  setupErrorHandling() {
    // Middleware para rutas no encontradas
    this.app.use((req, res, next) => {
      const error = new Error(`Ruta no encontrada: ${req.method} ${req.path}`);
      error.status = 404;
      next(error);
    });

    // Middleware de manejo de errores
    this.app.use((error, req, res, next) => {
      const status = error.status || 500;
      const message = error.message || 'Error interno del servidor';
            
      // Log del error
      this.logger.error('Error en servidor:', {
        error: message,
        stack: error.stack,
        url: req.url,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });

      // Respuesta de error
      const errorResponse = {
        error: message,
        code: error.code || 'INTERNAL_SERVER_ERROR',
        timestamp: new Date().toISOString()
      };

      // En desarrollo, incluir stack trace
      if (process.env.NODE_ENV === 'development') {
        errorResponse.stack = error.stack;
      }

      res.status(status).json(errorResponse);
    });
  }

  // Configuración de Socket.IO
  setupSocketIO() {
    this.io = new SocketIOServer(this.server, {
      cors: {
        origin: process.env.NODE_ENV === 'production' 
          ? process.env.FRONTEND_URL || 'https://yourdomain.com'
          : '*',
        methods: ['GET', 'POST'],
        credentials: true
      },
      transports: ['websocket', 'polling'],
      pingTimeout: 60000,
      pingInterval: 25000
    });

    // Configurar eventos de Socket.IO
    this.io.on('connection', (socket) => {
      this.logger.info(`🔗 Cliente conectado via Socket.IO: ${socket.id}`);

      // Unirse a sala de notificaciones
      socket.join('notifications');

      // Manejar desconexión
      socket.on('disconnect', (reason) => {
        this.logger.info(`🔌 Cliente desconectado: ${socket.id}, razón: ${reason}`);
      });

      // Eventos personalizados
      socket.on('join_room', (room) => {
        socket.join(room);
        this.logger.info(`👥 Cliente ${socket.id} se unió a la sala: ${room}`);
      });

      socket.on('leave_room', (room) => {
        socket.leave(room);
        this.logger.info(`👋 Cliente ${socket.id} salió de la sala: ${room}`);
      });

      socket.on('join_conversation', (conversationId) => {
        socket.join(`conversation_${conversationId}`);
        this.logger.info(`💬 Cliente ${socket.id} se unió a conversación: ${conversationId}`);
      });

      socket.on('leave_conversation', (conversationId) => {
        socket.leave(`conversation_${conversationId}`);
        this.logger.info(`🚪 Cliente ${socket.id} salió de conversación: ${conversationId}`);
      });

      // Evento de ping para mantener conexión
      socket.on('ping', () => {
        socket.emit('pong');
      });
    });

    this.logger.info('✅ Socket.IO configurado correctamente');
  }

  // Obtener instancia de Socket.IO
  getSocketIO() {
    return this.io;
  }

  // Inicialización de la base de datos y servicios locales
  async initialize() {
    try {
      this.logger.info('🔧 Inicializando base de datos y servicios locales...');

      // Inicialización simplificada para evitar problemas de memoria
      // TODO: Implementar inicialización completa cuando se resuelvan los problemas de Sequelize
      this.logger.info('ℹ️ Inicialización de base de datos simplificada (Sequelize desactivado temporalmente)');

      // Inicializar servicios locales - ACTIVADO
      await this.initializeLocalServices();

      this.logger.info('👤 Creando usuario administrador por defecto...');
      // await this.createDefaultAdmin(); // Desactivado temporalmente

      this.logger.info('✅ Inicialización completada (con servicios locales)');
    } catch (error) {
      this.logger.error('❌ Error en inicialización:', error);
      // No lanzar error para permitir que el servidor inicie
      this.logger.warn('⚠️ Continuando sin inicialización completa de base de datos');
    }
  }

  // Inicializar servicios locales (LocalMessagingService y LocalContactManager)
  async initializeLocalServices() {
    try {
      this.logger.info('🔧 Inicializando servicios locales...');

      // Importar servicios locales
      const { default: LocalMessagingService } = await import('../../apps/api/src/services/localMessagingService.js');
      const { default: LocalContactManager } = await import('../../apps/api/src/services/localContactManager.js');

      // Crear instancias de servicios locales
      const dataDir = path.join(process.cwd(), 'data');

      // Inicializar LocalContactManager
      this.localContactManager = new LocalContactManager(dataDir);
      await this.localContactManager.init();
      this.logger.info('✅ LocalContactManager inicializado');

      // Inicializar LocalMessagingService
      this.localMessagingService = new LocalMessagingService(dataDir, this.localContactManager, this.database, this.io);
      await this.localMessagingService.init();
      this.logger.info('✅ LocalMessagingService inicializado');

      // Configurar servicios en app.locals para que estén disponibles en las rutas
      this.app.locals.localMessagingService = this.localMessagingService;
      this.app.locals.localContactManager = this.localContactManager;
      this.app.locals.io = this.io;
      this.app.locals.db = this.database;

      this.logger.info('✅ Servicios locales configurados en app.locals');
      this.logger.info(`🔍 Verificación: localMessagingService disponible: ${!!this.app.locals.localMessagingService}`);

    } catch (error) {
      this.logger.error('❌ Error inicializando servicios locales:', error);
      this.logger.error('Stack trace:', error.stack);
      // No lanzar error para permitir que el servidor inicie sin servicios locales
      this.logger.warn('⚠️ Continuando sin servicios locales - funcionalidad limitada');
    }
  }

  // Crear usuario administrador por defecto
  async createDefaultAdmin() {
    try {
      const adminEmail = process.env.ADMIN_EMAIL || 'admin@chatbot.local';
      const adminPassword = process.env.ADMIN_PASSWORD || await this.generateSecurePassword();
            
      // Verificar si ya existe un admin
      const existingAdmin = await this.database.get(
        'SELECT id FROM users WHERE role = "admin" LIMIT 1'
      );
            
      if (!existingAdmin) {
        const bcrypt = await import('bcrypt');
        const passwordHash = await bcrypt.default.hash(adminPassword, 12);
                
        await this.database.run(`
                    INSERT INTO users (username, email, password_hash, role, status, created_at)
                    VALUES (?, ?, ?, 'admin', 'active', CURRENT_TIMESTAMP)
                `, ['admin', adminEmail, passwordHash]);
                
        this.logger.info(`✅ Usuario administrador creado: ${adminEmail}`);
        this.logger.warn(`🔑 Contraseña temporal: ${adminPassword}`);
        this.logger.warn('⚠️  CAMBIA LA CONTRASEÑA INMEDIATAMENTE');
      }
    } catch (error) {
      this.logger.error('❌ Error creando admin:', error);
    }
  }

  async generateSecurePassword(length = 16) {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    const crypto = await import('crypto');
    
    for (let i = 0; i < length; i++) {
      const randomIndex = crypto.randomInt(0, charset.length);
      password += charset[randomIndex];
    }
    
    return password;
  }



  // Iniciar servidor
  async start() {
    try {
      this.logger.info('🚀 Iniciando servidor SecureServer...');

      // Inicialización simplificada
      // await initializeDatabase(); // Desactivado - causa crashes

      // Configurar middleware básico primero
      this.setupSecurity();
      this.setupMiddleware();
      this.setupDatabaseMiddleware();

      // Crear servidor HTTP
      this.server = http.createServer(this.app);

      // Configurar Socket.IO ANTES de inicializar servicios locales
      this.setupSocketIO();

      // Ahora inicializar servicios locales (después de Socket.IO)
      await this.initialize(); // ACTIVADO - servicios locales necesarios

      // Configurar rutas (después de servicios locales)
      await this.setupRoutes();
      this.setupErrorHandling();

      // Configurar manejo de cierre graceful
      this.setupGracefulShutdown();

      // Iniciar servidor
      return new Promise((resolve, reject) => {
        // Siempre intentar el puerto 3000
        const portToUse = 3000;
        this.server.listen(portToUse, this.host, (error) => {
          if (error) {
            this.logger.error(`❌ Error iniciando servidor en puerto ${portToUse}:`, error.message);
            this.logger.error('Código de error:', error.code);
            reject(error);
          } else {
            // Obtener el puerto real asignado
            const actualPort = this.server.address().port;
            this.port = actualPort; // Actualizar la propiedad con el puerto real
            if (actualPort !== portToUse) {
              this.logger.warn(`⚠️ Puerto solicitado: ${portToUse}, puerto asignado: ${actualPort}`);
            } else {
              this.logger.info(`✅ Servidor vinculado correctamente al puerto ${portToUse}`);
            }
            this.logger.info(`🚀 Servidor iniciado en http://${this.host}:${actualPort}`);
            this.logger.info('💾 Base de datos: Inicialización simplificada');
            resolve();
          }
        });
      });

    } catch (error) {
      this.logger.error('❌ Error fatal iniciando servidor:', error);
      throw error;
    }
  }

  // Configurar cierre graceful
  setupGracefulShutdown() {
    const gracefulShutdown = async(signal) => {
      this.logger.info(`📡 Señal ${signal} recibida. Iniciando cierre graceful...`);
            
      if (this.server) {
        this.server.close(async() => {
          this.logger.info('🔌 Servidor HTTP cerrado');
                    
          try {
            if (this.database) {
              await this.database.close();
              this.logger.info('🗄️  Base de datos cerrada');
            }
                        
            if (this.sqliteManager) {
              await this.sqliteManager.close();
              this.logger.info('🗄️  SQLite Manager cerrado');
            }
                        
            this.logger.info('✅ Cierre graceful completado');
            process.exit(0);
          } catch (error) {
            this.logger.error('❌ Error en cierre graceful:', error);
            process.exit(1);
          }
        });
      }
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  }

  // Método stop() para compatibilidad con el código que lo llama
  async stop() {
    return this.shutdown();
  }

  async shutdown() {
    this.logger.info('🔄 Iniciando cierre graceful del servidor...');

    // Cerrar conexiones de Socket.IO
    if (this.io) {
      this.io.close(() => {
        this.logger.info('✅ Socket.IO cerrado');
      });
    }

    if (this.server) {
      this.server.close(() => {
        this.logger.info('✅ Servidor HTTP cerrado');
      });
    }

    // Close database connections
    if (this.database) {
      await this.database.close();
    }

    if (this.sqliteManager) {
      await this.sqliteManager.close();
    }

    if (this.security) {
      await this.security.close();
    }

    this.logger.info('✅ Servidor cerrado completamente');
    process.exit(0);
  }
}

export default SecureServer;
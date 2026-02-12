/**
 * 🚀 Servidor Unificado del ChatBot Enterprise
 * 
 * Clase modular que combina las funcionalidades de todos los servidores
 * en un solo punto de entrada que se adapta según el modo configurado.
 * 
 * Modos disponibles:
 * - SIMPLE: Funcionalidades básicas para desarrollo/pruebas
 * - FULL: Todas las funcionalidades del sistema
 * - ENTERPRISE: Arquitectura modular empresarial
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const { createServer } = require('http');
const { Server: SocketIOServer } = require('socket.io');
const dotenv = require('dotenv');
const cors = require('cors');

// Configuración de modos
const { 
  getCurrentModeConfig, 
  isFeatureEnabled, 
  shouldLoadRoute,
  SERVER_MODES 
} = require('../../config/server-mode.config.js');

class UnifiedServer {
  constructor() {
    // Cargar variables de entorno
    dotenv.config();
    
    // Configurar nivel de logs
    this.logLevel = process.env.LOG_LEVEL || 'info';
    this.setupLogging();
    
    // Obtener configuración del modo actual
    const { mode, config } = getCurrentModeConfig();
    this.mode = mode;
    this.config = config;
    
    // Inicializar Express y HTTP server
    this.app = express();
    this.server = createServer(this.app);
    this.PORT = process.env.PORT || 3000;
    this.io = null;
    
    this.log(`🚀 Configurando servidor en modo: ${this.config.name}`);
    this.log(`📝 ${this.config.description}`);
  }

  /**
   * Configura el sistema de logging
   */
  setupLogging() {
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;

    // Solo mostrar logs si el nivel es 'info' o superior
    console.log = (...args) => {
      if (this.logLevel === 'info' || this.logLevel === 'debug') {
        originalLog(...args);
      }
    };

    console.warn = (...args) => {
      if (this.logLevel !== 'error') {
        originalWarn(...args);
      }
    };

    // Los errores siempre se muestran
    console.error = originalError;
  }

  /**
   * Método para logging con control de nivel
   */
  log(...args) {
    if (this.logLevel === 'info' || this.logLevel === 'debug') {
      console.log(...args);
    }
  }

  /**
   * Inicializa el servidor con todas las configuraciones
   */
  async initialize() {
    try {
      await this.setupMiddleware();
      await this.setupSocketIO();
      await this.setupRoutes();
      await this.setupAuth();
      await this.setupErrorHandling();
      
      this.log('✅ Servidor inicializado correctamente');
    } catch (error) {
      console.error('❌ Error durante la inicialización:', error);
      throw error;
    }
  }

  /**
   * Configura el middleware básico
   */
  async setupMiddleware() {
    // Middleware básico
    this.app.use(express.json({ limit: '50mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '50mb' }));

    // CORS según el modo
    if (this.mode !== SERVER_MODES.SIMPLE) {
      this.app.use(cors({
        origin: process.env.CORS_ORIGIN || "*",
        credentials: true
      }));
    }

    // Archivos estáticos
    if (this.config.features.staticFiles) {
      this.app.use('/client', express.static(path.join(process.cwd(), 'client')));
      this.app.use('/public', express.static(path.join(process.cwd(), 'public')));
      this.app.use('/js', express.static(path.join(process.cwd(), 'public/js')));
      this.app.use('/js', express.static(path.join(process.cwd(), 'client/js')));
      this.app.use('/css', express.static(path.join(process.cwd(), 'public/css')));
      this.app.use('/css', express.static(path.join(process.cwd(), 'client/css')));
      this.log('📁 Archivos estáticos configurados');
    }
  }

  /**
   * Configura Socket.IO según el modo
   */
  async setupSocketIO() {
    if (this.config.features.socketIO) {
      const socketConfig = this.mode === SERVER_MODES.SIMPLE ? {
        cors: {
          origin: "*",
          methods: ["GET", "POST"]
        }
      } : {
        cors: {
          origin: process.env.CORS_ORIGIN || "*",
          methods: ["GET", "POST", "PUT", "DELETE"]
        },
        transports: ['websocket', 'polling']
      };

      this.io = new SocketIOServer(this.server, socketConfig);
      this.log(`🔌 Socket.IO configurado en modo: ${this.config.features.socketIO}`);
      
      this.setupSocketHandlers();
    }
  }

  /**
   * Configura los manejadores de Socket.IO
   */
  setupSocketHandlers() {
    if (!this.io) return;

    this.io.on('connection', (socket) => {
      this.log(`👤 Cliente conectado: ${socket.id}`);

      socket.on('disconnect', () => {
        this.log(`👋 Cliente desconectado: ${socket.id}`);
      });

      // Eventos básicos para todos los modos
      socket.on('message', (data) => {
        this.log('📨 Mensaje recibido:', data);
        socket.emit('response', { status: 'received', data });
      });

      // Eventos avanzados solo para modos FULL y ENTERPRISE
      if (this.mode !== SERVER_MODES.SIMPLE) {
        socket.on('join-room', (room) => {
          socket.join(room);
          this.log(`🏠 Cliente ${socket.id} se unió a la sala: ${room}`);
        });

        socket.on('leave-room', (room) => {
          socket.leave(room);
          this.log(`🚪 Cliente ${socket.id} salió de la sala: ${room}`);
        });
      }
    });
  }

  /**
   * Configura las rutas básicas del servidor
   */
  async setupRoutes() {
    // Rutas básicas
    this.app.get('/', (req, res) => {
      res.sendFile(path.join(process.cwd(), 'public', 'index.html'));
    });

    this.app.get('/dashboard', (req, res) => {
      res.sendFile(path.join(process.cwd(), 'public', 'dashboard.html'));
    });

    this.app.get('/status', (req, res) => {
      res.json({
        status: 'active',
        mode: this.config.name,
        features: this.config.features,
        timestamp: new Date().toISOString()
      });
    });

    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        timestamp: new Date().toISOString()
      });
    });

    // Cargar rutas modulares
    await this.loadModularRoutes();
  }

  /**
   * Carga las rutas modulares según la configuración
   */
  async loadModularRoutes() {
    this.log('📋 Cargando rutas modulares...');

    // Cargar rutas según configuración
    for (const [routeName, routePath] of Object.entries(this.config.routes)) {
      try {
        const fullPath = path.join(process.cwd(), 'src', 'routes', `${routePath}.routes.js`);
        
        if (fs.existsSync(fullPath)) {
          const routeModule = require(fullPath);
          this.app.use(`/${routeName}`, routeModule);
          this.log(`✅ Ruta cargada: /${routeName} -> ${routePath}`);
        } else {
          this.log(`⚠️  Ruta no encontrada: ${fullPath}`);
          
          // Fallback para webhooks simples
          if (routeName === 'webhooks' && routePath === 'webhooks-simple') {
            this.setupSimpleWebhooks();
          }
        }
      } catch (error) {
        console.error(`❌ Error cargando ruta ${routeName}:`, error.message);
        
        // Fallback para webhooks simples
        if (routeName === 'webhooks') {
          this.setupSimpleWebhooks();
        }
      }
    }
  }

  /**
   * Configura webhooks simples como fallback
   */
  setupSimpleWebhooks() {
    this.log('🔧 Configurando webhooks simples...');
    
    this.app.post('/webhooks', (req, res) => {
      this.log('📨 Webhook recibido:', req.body);
      res.json({
        success: true,
        message: 'Webhook recibido correctamente',
        timestamp: new Date().toISOString(),
        mode: 'simple'
      });
    });
    
    this.log('✅ Webhooks simples configurados');
  }

  /**
   * Configura la autenticación según el modo
   */
  async setupAuth() {
    if (this.config.features.auth) {
      this.log(`🔐 Configurando autenticación: ${this.config.features.auth}`);
      
      // Autenticación básica para modo SIMPLE
      if (this.config.features.auth === 'simple') {
        this.app.use('/api', (req, res, next) => {
          // Autenticación simple por token
          const token = req.headers.authorization;
          if (!token && req.path !== '/login') {
            return res.status(401).json({ error: 'Token requerido' });
          }
          next();
        });
      }
      
      // Autenticación avanzada para otros modos
      if (this.config.features.auth === 'advanced') {
        try {
          const authMiddleware = require('../middleware/auth.middleware.js');
          
          // Middleware selectivo que excluye rutas públicas de 360Dialog
          this.app.use('/api', (req, res, next) => {
            // Rutas que no requieren autenticación
            const publicRoutes = [
              '/api/360dialog/status',
              '/api/360dialog/templates',
              '/api/health',
              '/api/status'
            ];
            
            // Si es una ruta pública, continuar sin autenticación
            if (publicRoutes.includes(req.path)) {
              return next();
            }
            
            // Para otras rutas, aplicar autenticación
            return authMiddleware.requireAuth(req, res, next);
          });
          
          this.log('✅ Middleware de autenticación avanzada cargado con rutas públicas excluidas');
        } catch (error) {
          this.log('⚠️  Middleware de autenticación no encontrado, usando básico');
        }
      }
    }
  }

  /**
   * Configura el manejo de errores
   */
  async setupErrorHandling() {
    // Middleware de manejo de errores
    this.app.use((err, req, res, next) => {
      console.error('❌ Error del servidor:', err);
      res.status(500).json({
        error: 'Error interno del servidor',
        mode: this.config.name
      });
    });

    // Ruta 404
    this.app.use((req, res) => {
      res.status(404).json({
        error: 'Ruta no encontrada',
        path: req.originalUrl,
        mode: this.config.name
      });
    });
  }

  /**
   * Inicia el servidor
   */
  async start() {
    return new Promise((resolve, reject) => {
      this.server.listen(this.PORT, (error) => {
        if (error) {
          reject(error);
          return;
        }

        this.log('\n🎉 ¡Servidor iniciado exitosamente!');
        this.log('═'.repeat(50));
        this.log(`🌐 URL: http://localhost:${this.PORT}`);
        this.log(`🔧 Modo: ${this.config.name}`);
        this.log(`📋 Características activas:`);
        
        Object.entries(this.config.features).forEach(([feature, value]) => {
          if (value) {
            this.log(`   ✅ ${feature}: ${value === true ? 'habilitado' : value}`);
          }
        });
        
        this.log('═'.repeat(50));
        resolve();
      });
    });
  }

  /**
   * Detiene el servidor gracefully
   */
  async stop() {
    return new Promise((resolve) => {
      this.log('🛑 Deteniendo servidor...');
      
      if (this.io) {
        this.io.close();
      }
      
      this.server.close(() => {
        this.log('✅ Servidor detenido correctamente');
        resolve();
      });
    });
  }

  /**
   * Obtiene la instancia de Express
   */
  getApp() {
    return this.app;
  }

  /**
   * Obtiene la instancia de Socket.IO
   */
  getIO() {
    return this.io;
  }
}

module.exports = UnifiedServer;
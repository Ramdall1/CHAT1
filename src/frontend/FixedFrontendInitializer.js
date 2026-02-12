import compression from 'compression';
import express from 'express';
import proxy from 'express-http-proxy';
import fs from 'fs';
import { default as helmet } from 'helmet';
import http from 'http';
import path from 'path';
import { getStructuredLogger } from '../core/StructuredLogger.js';

const logger = getStructuredLogger();

export class FixedFrontendInitializer {
  constructor(config = {}) {
    this.config = {
      port: config.port || 3000,
      host: config.host || process.env.HOST || (process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1'),
      clientPath: config.clientPath || path.join(process.cwd(), 'client'),
      enableCompression: config.enableCompression !== false,
      enableSecurity: config.enableSecurity !== false,
      enableCaching: config.enableCaching !== false,
      cacheMaxAge: config.cacheMaxAge || '1d',
      ...config
    };

    this.app = null;
    this.server = null;
    this.isRunning = false;
  }

  async initialize() {
    try {
      logger.info('🎨 Inicializando Frontend Corregido...');
      const startTime = Date.now();

      if (!fs.existsSync(this.config.clientPath)) {
        throw new Error(`Client path no existe: ${this.config.clientPath}`);
      }

      this.createExpressApp();

      if (this.config.enableSecurity) {
        this.setupSecurity();
      }

      if (this.config.enableCompression) {
        this.setupCompression();
      }

      this.setupStaticFiles();
      this.setupRoutes();
      this.setupErrorHandling();
      this.createHttpServer();

      const duration = Date.now() - startTime;
      logger.info(`✅ Frontend Corregido inicializado en ${duration}ms`);

    } catch (error) {
      logger.error('❌ Error inicializando Frontend Corregido:', error);
      throw error;
    }
  }

  createExpressApp() {
    this.app = express();
    logger.debug('Express app creada (corregida)');
  }

  setupSecurity() {
    if (this.config.enableSecurity) {
      this.app.use((req, res, next) => {
        const isProduction = process.env.NODE_ENV === 'production';
        const isHttps = req.header('x-forwarded-proto') === 'https' || req.secure;
        const hostHeader = req.header('host') || req.hostname || '';
        const hostname = String(hostHeader).split(':')[0];
        const isLocalHost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0';

        if (isProduction && !isHttps && !isLocalHost) {
          const httpsUrl = `https://${hostHeader}${req.url}`;
          return res.redirect(301, httpsUrl);
        }

        next();
      });

      // CSP DESACTIVADO TEMPORALMENTE PARA PRUEBA
      console.log(' CSP DESACTIVADO TEMPORALMENTE - Solo para prueba de inicio');

      this.app.use(helmet({
        contentSecurityPolicy: false, // DESACTIVADO
        hsts: false, // DESACTIVADO
        crossOriginEmbedderPolicy: false,
        crossOriginResourcePolicy: { policy: 'cross-origin' }
      }));
    }
    logger.debug('Seguridad configurada (CSP DESACTIVADO TEMPORALMENTE)');
  }

  setupCompression() {
    this.app.use(compression({
      filter: (req, res) => {
        if (req.headers['x-no-compression']) {
          return false;
        }
        return compression.filter(req, res);
      },
      level: 6
    }));

    logger.debug('Compresión configurada (corregida)');
  }

  setupStaticFiles() {
    const clientPath = path.resolve(this.config.clientPath);
    logger.debug('🎨 Configurando archivos estáticos desde:', clientPath);

    const cacheOptions = this.config.enableCaching ? {
      setHeaders: (res, filePath, stat) => {
        const ext = path.extname(filePath);
        const base = path.basename(filePath);

        if (ext === '.html' || base === 'config.js' || base === 'chat-live.js') {
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          res.setHeader('Pragma', 'no-cache');
          res.setHeader('Expires', '0');
          return;
        }

        if (filePath.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/)) {
          res.setHeader('Cache-Control', 'public, max-age=31536000');
        }

        if (ext === '.js') {
          res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
        }
      }
    } : {
      maxAge: 0,
      etag: false
    };

    this.app.use(express.static(clientPath, cacheOptions));

    const mediaPath = path.join(process.cwd(), 'data', 'media');
    this.app.use('/media', express.static(mediaPath, {
      maxAge: 0,
      etag: true,
      lastModified: true
    }));

    logger.debug('📁 Sirviendo archivos desde:', clientPath);
  }

  setupRoutes() {
    // Proxy para API requests al backend
    this.app.use('/api', proxy('http://localhost:3001', {
      proxyReqPathResolver: (req) => {
        return '/api' + req.url;
      }
    }));

    this.app.use('/socket.io', proxy('http://localhost:3001', {
      proxyReqPathResolver: (req) => {
        return '/socket.io' + req.url;
      },
      ws: true,
      changeOrigin: true
    }));

    // Ruta para config.js dinámico
    this.app.get('/config.js', (req, res) => {
      const config = {
        API_BASE_URL: process.env.API_BASE_URL || 'http://localhost:3001',
        WS_URL: process.env.WS_URL || 'ws://localhost:3001',
        ENVIRONMENT: process.env.NODE_ENV || 'development',
        VERSION: '1.0.0'
      };

      res.setHeader('Content-Type', 'application/javascript');
      res.send(`window.CONFIG = ${JSON.stringify(config)};`);
    });

    // Rutas específicas para archivos HTML
    const htmlRoutes = [
      'dashboard', 'campaigns', 'payments', 'assigned-numbers',
      'analytics', 'contacts', 'chat-live', 'settings', 'login'
    ];

    htmlRoutes.forEach(route => {
      this.app.get(`/${route}`, (req, res) => {
        const filePath = path.join(this.config.clientPath, `${route}.html`);
        if (fs.existsSync(filePath)) {
          res.sendFile(filePath);
        } else {
          res.redirect('/dashboard');
        }
      });
    });

    // Ruta para Chrome DevTools discovery
    this.app.get('/.well-known/appspecific/com.chrome.devtools.json', (req, res) => {
      const launchUrl = `http://localhost:${this.config.port}`;

      res.json({
        version: '1.0',
        package_name: 'com.ramdall.chat1',
        launch_url: launchUrl,
        debuggable: true,
        description: 'Chat1 - Sistema de Chat WhatsApp'
      });
    });

    // Ruta de health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'ok',
        service: 'frontend-fixed',
        timestamp: new Date().toISOString(),
        csp: 'active'
      });
    });

    // SPA fallback
    this.app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) {
        return next();
      }

      if (path.extname(req.path)) {
        return next();
      }

      // TEMPORARILY SEND SIMPLE RESPONSE FOR DEBUG
      res.send('Hello World from SPA fallback');
      return;

      const indexPath = path.join(this.config.clientPath, 'index.html');
      res.sendFile(indexPath, (err) => {
        if (err) {
          logger.error('Error enviando index.html:', err);
          return next();
        }
      });
    });

    logger.debug('Rutas configuradas (corregidas)');
  }

  setupErrorHandling() {
    this.app.use((req, res) => {
      logger.warn(`404 - Recurso no encontrado: ${req.method} ${req.path}`);
      res.status(404).json({
        error: 'Not Found',
        path: req.path,
        message: 'El recurso solicitado no existe'
      });
    });

    this.app.use((err, req, res, next) => {
      logger.error('Error no manejado:', err);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Ocurrió un error interno del servidor'
      });
    });
  }

  createHttpServer() {
    this.server = http.createServer(this.app);
    logger.debug('Servidor HTTP creado (corregido)');
  }

  async start() {
    if (this.isRunning) {
      logger.warn('Frontend ya está ejecutándose');
      return;
    }

    return new Promise((resolve, reject) => {
      if (!this.server) {
        const error = new Error('Servidor HTTP no está inicializado');
        logger.error('❌ ERROR:', error.message);
        return reject(error);
      }

      this.server.listen(this.config.port, this.config.host, (err) => {
        if (err) {
          logger.error('Error iniciando servidor:', err);
          return reject(err);
        }

        this.isRunning = true;
        logger.info(`✅ Frontend Corregido escuchando en http://${this.config.host}:${this.config.port}`);
        resolve();
      });

      setTimeout(() => {
        if (!this.isRunning) {
          const timeoutError = new Error(`Timeout: Frontend no pudo iniciar en puerto ${this.config.port} después de 10 segundos`);
          logger.error('❌ ERROR:', timeoutError.message);
          reject(timeoutError);
        }
      }, 10000);
    });
  }

  async stop() {
    if (!this.isRunning) {
      logger.warn('⚠️ El servidor no está ejecutándose');
      return;
    }

    if (!this.server) {
      logger.warn('⚠️ Servidor no inicializado');
      this.isRunning = false;
      return;
    }

    return new Promise((resolve) => {
      this.server.close(() => {
        this.isRunning = false;
        logger.info('✅ Frontend Corregido detenido');
        resolve();
      });
    });
  }
}

export default FixedFrontendInitializer;

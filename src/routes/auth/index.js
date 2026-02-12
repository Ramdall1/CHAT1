/**
 * @fileoverview Rutas de Autenticación
 * 
 * Módulo que maneja todas las rutas relacionadas con autenticación,
 * extraído del archivo server.js monolítico para mejorar la modularidad.
 * 
 * @author ChatBot Enterprise Team
 * @version 1.0.0
 */

import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { createLogger } from '../../services/core/core/logger.js';

const logger = createLogger('AUTH');

const router = express.Router();

/**
 * Configuración de autenticación
 */
const AUTH_CONFIG = {
  JWT_SECRET: process.env.JWT_SECRET || 'Kx9#mP2$vL8@nQ5!wR7&tY4^uI6*oE3%aS1+dF0-gH9=jK2#',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '24h',
  REFRESH_TOKEN_EXPIRES_IN: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d'
};

/**
 * Usuarios por defecto (en producción esto vendría de una base de datos)
 */
const DEFAULT_USERS = [
  {
    id: 1,
    username: 'admin',
    email: 'admin@chatbot.com',
    password: '$2b$10$xBm3F13Gn9YlzjcdCRx8FeN6ZTJHr1t.dGigovGiwAXFx.7BaljSm', // 'admin123'
    role: 'admin'
  }
];

/**
 * POST /api/auth/login-simple
 * Endpoint simple para debugging
 */
router.post('/login-simple', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Username y password son requeridos'
      });
    }

    // Login simple sin bcrypt para debugging
    if (username === 'admin' && password === 'admin123') {
      const accessToken = jwt.sign(
        { 
          userId: 1, 
          username: 'admin', 
          role: 'admin' 
        },
        AUTH_CONFIG.JWT_SECRET,
        { expiresIn: AUTH_CONFIG.JWT_EXPIRES_IN }
      );

      return res.json({
        success: true,
        data: {
          user: {
            id: 1,
            username: 'admin',
            email: 'admin@chatbot.com',
            role: 'admin'
          },
          tokens: {
            accessToken,
            expiresIn: AUTH_CONFIG.JWT_EXPIRES_IN
          }
        }
      });
    } else {
      return res.status(401).json({
        success: false,
        error: 'Credenciales inválidas'
      });
    }

  } catch (error) {
    logger.error('Error en login simple:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

/**
 * POST /api/auth/login
 * Endpoint para autenticación de usuarios con cookies HTTP-only
 */
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Username y password son requeridos'
      });
    }

    // Buscar usuario (en producción sería desde base de datos)
    const user = DEFAULT_USERS.find(u => u.username === username);
    
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Credenciales inválidas'
      });
    }

    logger.info(`Usuario encontrado: ${JSON.stringify(user)}`);
    logger.info(`Password recibido: ${password}`);
    logger.info(`Hash almacenado: ${user.password}`);

    // Verificar que el password hash existe
    if (!user.password) {
      logger.error('Password hash no encontrado para el usuario');
      return res.status(401).json({
        success: false,
        error: 'Credenciales inválidas'
      });
    }

    // Verificar password
    const isValidPassword = await bcrypt.compare(password, user.password);
    
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        error: 'Credenciales inválidas'
      });
    }

    // Generar ID de sesión único
    const sessionId = crypto.randomUUID();
    
    // Generar tokens para almacenar en la sesión
    const accessToken = jwt.sign(
      { 
        userId: user.id, 
        username: user.username, 
        role: user.role,
        sessionId: sessionId
      },
      AUTH_CONFIG.JWT_SECRET,
      { expiresIn: AUTH_CONFIG.JWT_EXPIRES_IN }
    );

    const refreshToken = jwt.sign(
      { userId: user.id, sessionId: sessionId },
      AUTH_CONFIG.JWT_SECRET,
      { expiresIn: AUTH_CONFIG.REFRESH_TOKEN_EXPIRES_IN }
    );

    // Crear hash de los tokens para almacenar en SQLite
    const tokenHash = crypto.createHash('sha256').update(accessToken).digest('hex');
    const refreshTokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

    // Calcular fecha de expiración (7 días)
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    
    // Almacenar sesión en SQLite
    try {
      if (req.database) {
        const db = req.database.getManager ? req.database.getManager() : req.database;
        
        await db.run(`
          INSERT INTO sessions (
            id, user_id, token_hash, refresh_token_hash, 
            expires_at, created_at, last_activity, 
            ip_address, user_agent, is_active
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          sessionId,
          user.id,
          tokenHash,
          refreshTokenHash,
          expiresAt.toISOString(),
          new Date().toISOString(),
          new Date().toISOString(),
          req.ip || req.connection.remoteAddress,
          req.get('User-Agent') || 'Unknown',
          1
        ]);
        
        logger.info(`Sesión ${sessionId} almacenada en SQLite para usuario ${username}`);
      } else {
        logger.warn('Base de datos no disponible, sesión no almacenada');
      }
      
      // Configurar cookie HTTP-only con el sessionId
      res.cookie('sessionId', sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production', // HTTPS en producción
        sameSite: 'lax', // Cambiado de 'strict' a 'lax' para compatibilidad con Safari
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 días
        path: '/'
      });

      logger.info(`Usuario ${username} autenticado exitosamente con sesión segura`);

      // Responder sin tokens - solo datos del usuario
      res.json({
        success: true,
        message: 'Autenticación exitosa',
        data: {
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role
          }
        }
      });

    } catch (sessionError) {
      logger.error('Error creando sesión:', sessionError);
      return res.status(500).json({
        success: false,
        error: 'Error creando sesión'
      });
    }

  } catch (error) {
    logger.error('Error en login:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

/**
 * POST /api/auth/refresh
 * Endpoint para renovar tokens de acceso
 */
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        error: 'Refresh token requerido'
      });
    }

    // Verificar refresh token
    const decoded = jwt.verify(refreshToken, AUTH_CONFIG.JWT_SECRET);
    const user = DEFAULT_USERS.find(u => u.id === decoded.userId);

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Token inválido'
      });
    }

    // Generar nuevo access token
    const newAccessToken = jwt.sign(
      { 
        userId: user.id, 
        username: user.username, 
        role: user.role 
      },
      AUTH_CONFIG.JWT_SECRET,
      { expiresIn: AUTH_CONFIG.JWT_EXPIRES_IN }
    );

    res.json({
      success: true,
      data: {
        accessToken: newAccessToken,
        expiresIn: AUTH_CONFIG.JWT_EXPIRES_IN
      }
    });

  } catch (error) {
    logger.error('Error en refresh token:', error);
    res.status(401).json({
      success: false,
      error: 'Token inválido o expirado'
    });
  }
});

/**
 * POST /api/auth/logout
 * Endpoint para cerrar sesión
 */
router.post('/logout', async (req, res) => {
  try {
    // Obtener el sessionId de las cookies
    const sessionId = req.cookies?.sessionId;
    
    if (sessionId) {
      // Invalidar la sesión en la base de datos
      try {
        if (req.database) {
          const db = req.database.getManager ? req.database.getManager() : req.database;
          
          await db.run(`
            UPDATE sessions 
            SET is_active = 0, 
                updated_at = datetime('now')
            WHERE id = ? AND is_active = 1
          `, [sessionId]);
          
          logger.info(`Sesión ${sessionId} invalidada en la base de datos`);
        }
      } catch (dbError) {
        logger.error('Error invalidando sesión en la base de datos:', dbError);
      }
      
      // Invalidar la cookie estableciendo una fecha de expiración pasada
      res.clearCookie('sessionId', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/'
      });
      
      logger.info(`Sesión ${sessionId} cerrada exitosamente`);
    }
    
    res.json({
      success: true,
      message: 'Sesión cerrada exitosamente'
    });

  } catch (error) {
    logger.error('Error en logout:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

/**
 * GET /api/auth/profile
 * Endpoint para obtener perfil del usuario autenticado
 */
router.get('/profile', (req, res) => {
  try {
    // El middleware de autenticación debe haber agregado req.user
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'No autenticado'
      });
    }

    const user = DEFAULT_USERS.find(u => u.id === req.user.userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Usuario no encontrado'
      });
    }

    res.json({
      success: true,
      data: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });

  } catch (error) {
    logger.error('Error obteniendo perfil:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

export default router;
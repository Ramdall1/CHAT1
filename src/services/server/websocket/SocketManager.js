/**
 * @fileoverview Gestor de WebSocket del Servidor
 * 
 * Módulo especializado para la configuración y gestión de WebSocket
 * usando Socket.IO. Centraliza toda la lógica de comunicación en tiempo real.
 * 
 * @author ChatBot Enterprise Team
 * @version 1.0.0
 */

import { Server as SocketIOServer } from 'socket.io';
import { createLogger } from '../../core/core/logger.js';

const logger = createLogger('SOCKET_MANAGER');

/**
 * Gestor de WebSocket
 */
export class SocketManager {
  constructor(httpServer, config = {}) {
    this.httpServer = httpServer;
    this.config = {
      cors: {
        origin: config.allowedOrigins || process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
        methods: ['GET', 'POST']
      },
      updateInterval: config.updateInterval || 30000, // 30 segundos
      enableDashboardUpdates: config.enableDashboardUpdates !== false,
      enableRoomManagement: config.enableRoomManagement !== false,
      ...config
    };

    this.io = null;
    this.connectedClients = new Map();
    this.rooms = new Map();
    this.updateInterval = null;
  }

  /**
   * Inicializar Socket.IO
   */
  initialize() {
    try {
      logger.info('Inicializando Socket.IO...');

      this.io = new SocketIOServer(this.httpServer, {
        cors: this.config.cors
      });

      this.setupEventHandlers();
      this.setupPeriodicUpdates();

      logger.info('Socket.IO inicializado exitosamente');
      
    } catch (error) {
      logger.error('Error inicializando Socket.IO:', error);
      throw error;
    }
  }

  /**
   * Configurar manejadores de eventos
   */
  setupEventHandlers() {
    try {
      this.io.on('connection', (socket) => {
        this.handleConnection(socket);
      });

      logger.info('Manejadores de eventos configurados');

    } catch (error) {
      logger.error('Error configurando manejadores de eventos:', error);
      throw error;
    }
  }

  /**
   * Manejar nueva conexión
   */
  handleConnection(socket) {
    try {
      const clientInfo = {
        id: socket.id,
        connectedAt: new Date().toISOString(),
        rooms: new Set(),
        lastActivity: new Date().toISOString()
      };

      this.connectedClients.set(socket.id, clientInfo);
      logger.info(`Cliente conectado: ${socket.id} (Total: ${this.connectedClients.size})`);

      // Configurar eventos del cliente
      this.setupClientEvents(socket);

      // Enviar información de bienvenida
      socket.emit('welcome', {
        clientId: socket.id,
        serverTime: new Date().toISOString(),
        connectedClients: this.connectedClients.size
      });

    } catch (error) {
      logger.error(`Error manejando conexión ${socket.id}:`, error);
    }
  }

  /**
   * Configurar eventos del cliente
   */
  setupClientEvents(socket) {
    // Unirse a una sala
    socket.on('join_room', (room) => {
      this.handleJoinRoom(socket, room);
    });

    // Salir de una sala
    socket.on('leave_room', (room) => {
      this.handleLeaveRoom(socket, room);
    });

    // Mensaje de chat
    socket.on('chat_message', (data) => {
      this.handleChatMessage(socket, data);
    });

    // Actualización de estado
    socket.on('status_update', (data) => {
      this.handleStatusUpdate(socket, data);
    });

    // Desconexión
    socket.on('disconnect', (reason) => {
      this.handleDisconnection(socket, reason);
    });

    // Ping/Pong para mantener conexión
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: new Date().toISOString() });
      this.updateClientActivity(socket.id);
    });
  }

  /**
   * Manejar unirse a sala
   */
  handleJoinRoom(socket, room) {
    try {
      if (!room || typeof room !== 'string') {
        socket.emit('error', { message: 'Nombre de sala inválido' });
        return;
      }

      socket.join(room);
      
      const clientInfo = this.connectedClients.get(socket.id);
      if (clientInfo) {
        clientInfo.rooms.add(room);
        clientInfo.lastActivity = new Date().toISOString();
      }

      // Actualizar información de la sala
      if (!this.rooms.has(room)) {
        this.rooms.set(room, {
          name: room,
          clients: new Set(),
          createdAt: new Date().toISOString()
        });
      }
      
      this.rooms.get(room).clients.add(socket.id);

      logger.info(`Cliente ${socket.id} se unió a la sala ${room}`);
      
      // Notificar a otros en la sala
      socket.to(room).emit('user_joined', {
        clientId: socket.id,
        room: room,
        timestamp: new Date().toISOString()
      });

      // Confirmar al cliente
      socket.emit('room_joined', {
        room: room,
        clientsInRoom: this.rooms.get(room).clients.size
      });

    } catch (error) {
      logger.error(`Error uniendo cliente ${socket.id} a sala ${room}:`, error);
      socket.emit('error', { message: 'Error uniéndose a la sala' });
    }
  }

  /**
   * Manejar salir de sala
   */
  handleLeaveRoom(socket, room) {
    try {
      socket.leave(room);
      
      const clientInfo = this.connectedClients.get(socket.id);
      if (clientInfo) {
        clientInfo.rooms.delete(room);
        clientInfo.lastActivity = new Date().toISOString();
      }

      // Actualizar información de la sala
      if (this.rooms.has(room)) {
        this.rooms.get(room).clients.delete(socket.id);
        
        // Eliminar sala si está vacía
        if (this.rooms.get(room).clients.size === 0) {
          this.rooms.delete(room);
        }
      }

      logger.info(`Cliente ${socket.id} salió de la sala ${room}`);
      
      // Notificar a otros en la sala
      socket.to(room).emit('user_left', {
        clientId: socket.id,
        room: room,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error(`Error sacando cliente ${socket.id} de sala ${room}:`, error);
    }
  }

  /**
   * Manejar mensaje de chat
   */
  handleChatMessage(socket, data) {
    try {
      const { room, message, type = 'text' } = data;
      
      if (!room || !message) {
        socket.emit('error', { message: 'Datos de mensaje inválidos' });
        return;
      }

      const messageData = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        clientId: socket.id,
        room: room,
        message: message,
        type: type,
        timestamp: new Date().toISOString()
      };

      // Enviar a todos en la sala
      this.io.to(room).emit('chat_message', messageData);
      
      this.updateClientActivity(socket.id);
      logger.info(`Mensaje de chat en sala ${room} de cliente ${socket.id}`);

    } catch (error) {
      logger.error(`Error procesando mensaje de chat:`, error);
      socket.emit('error', { message: 'Error procesando mensaje' });
    }
  }

  /**
   * Manejar actualización de estado
   */
  handleStatusUpdate(socket, data) {
    try {
      const clientInfo = this.connectedClients.get(socket.id);
      if (clientInfo) {
        clientInfo.status = data.status;
        clientInfo.lastActivity = new Date().toISOString();
      }

      // Broadcast a salas del cliente
      if (clientInfo && clientInfo.rooms.size > 0) {
        clientInfo.rooms.forEach(room => {
          socket.to(room).emit('status_update', {
            clientId: socket.id,
            status: data.status,
            timestamp: new Date().toISOString()
          });
        });
      }

    } catch (error) {
      logger.error(`Error actualizando estado de cliente ${socket.id}:`, error);
    }
  }

  /**
   * Manejar desconexión
   */
  handleDisconnection(socket, reason) {
    try {
      const clientInfo = this.connectedClients.get(socket.id);
      
      if (clientInfo) {
        // Notificar a todas las salas del cliente
        clientInfo.rooms.forEach(room => {
          socket.to(room).emit('user_disconnected', {
            clientId: socket.id,
            room: room,
            timestamp: new Date().toISOString()
          });

          // Limpiar sala
          if (this.rooms.has(room)) {
            this.rooms.get(room).clients.delete(socket.id);
            if (this.rooms.get(room).clients.size === 0) {
              this.rooms.delete(room);
            }
          }
        });

        this.connectedClients.delete(socket.id);
      }

      logger.info(`Cliente desconectado: ${socket.id} (Razón: ${reason}, Total: ${this.connectedClients.size})`);

    } catch (error) {
      logger.error(`Error manejando desconexión ${socket.id}:`, error);
    }
  }

  /**
   * Configurar actualizaciones periódicas
   */
  setupPeriodicUpdates() {
    if (!this.config.enableDashboardUpdates) {
      logger.info('Actualizaciones periódicas deshabilitadas');
      return;
    }

    try {
      this.updateInterval = setInterval(() => {
        this.sendDashboardUpdate();
      }, this.config.updateInterval);

      logger.info(`Actualizaciones periódicas configuradas (cada ${this.config.updateInterval}ms)`);

    } catch (error) {
      logger.error('Error configurando actualizaciones periódicas:', error);
    }
  }

  /**
   * Enviar actualización del dashboard
   */
  sendDashboardUpdate() {
    try {
      const updateData = {
        timestamp: new Date().toISOString(),
        activeUsers: this.connectedClients.size,
        activeRooms: this.rooms.size,
        systemStatus: 'healthy',
        uptime: process.uptime()
      };

      this.io.emit('dashboard_update', updateData);

    } catch (error) {
      logger.error('Error enviando actualización del dashboard:', error);
    }
  }

  /**
   * Actualizar actividad del cliente
   */
  updateClientActivity(clientId) {
    const clientInfo = this.connectedClients.get(clientId);
    if (clientInfo) {
      clientInfo.lastActivity = new Date().toISOString();
    }
  }

  /**
   * Obtener información del socket manager
   */
  getInfo() {
    return {
      connectedClients: this.connectedClients.size,
      activeRooms: this.rooms.size,
      config: this.config,
      rooms: Array.from(this.rooms.keys()),
      clients: Array.from(this.connectedClients.keys())
    };
  }

  /**
   * Detener el socket manager
   */
  stop() {
    try {
      if (this.updateInterval) {
        clearInterval(this.updateInterval);
        this.updateInterval = null;
      }

      if (this.io) {
        this.io.close();
      }

      logger.info('Socket manager detenido');

    } catch (error) {
      logger.error('Error deteniendo socket manager:', error);
    }
  }
}

export default SocketManager;
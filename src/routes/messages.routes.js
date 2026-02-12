/**
 * Rutas para gestionar el status de mensajes (como WhatsApp)
 * Actualiza status: sent → delivered → read
 */

import express from 'express';
import sqlite3 from 'sqlite3';
import path from 'path';
import { createLogger } from '../services/core/core/logger.js';

const router = express.Router();
const logger = createLogger('MESSAGE_STATUS');

const DB_PATH = path.join(process.cwd(), 'data', 'database.sqlite');

/**
 * Actualizar status de mensaje
 * POST /messages/:messageId/status
 */
router.post('/:messageId/status', async (req, res) => {
  const { messageId } = req.params;
  const { status } = req.body;

  if (!messageId || !status) {
    return res.status(400).json({
      success: false,
      error: 'messageId y status son requeridos'
    });
  }

  const validStatuses = ['sent', 'delivered', 'read', 'failed'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({
      success: false,
      error: `Status inválido. Debe ser uno de: ${validStatuses.join(', ')}`
    });
  }

  const db = new sqlite3.Database(DB_PATH);

  try {
    const message = await new Promise((resolve, reject) => {
      db.get(
        'SELECT id, status FROM messages WHERE id = ?',
        [messageId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (!message) {
      db.close();
      return res.status(404).json({
        success: false,
        error: 'Mensaje no encontrado'
      });
    }

    let updateColumn = '';
    switch (status) {
      case 'sent':
        updateColumn = 'sent_at';
        break;
      case 'delivered':
        updateColumn = 'delivered_at';
        break;
      case 'read':
        updateColumn = 'read_at';
        break;
      case 'failed':
        updateColumn = 'failed_at';
        break;
    }

    await new Promise((resolve, reject) => {
      db.run(
        `UPDATE messages SET status = ?, ${updateColumn} = ? WHERE id = ?`,
        [status, new Date().toISOString(), messageId],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    logger.info(`✅ Mensaje ${messageId} actualizado a status: ${status}`);

    db.close();

    res.json({
      success: true,
      message: `Status actualizado a: ${status}`,
      data: {
        messageId,
        status,
        icon: getStatusIcon(status),
        color: getStatusColor(status)
      }
    });

  } catch (error) {
    logger.error('❌ Error actualizando status:', error);
    db.close();
    
    res.status(500).json({
      success: false,
      error: 'Error al actualizar status: ' + error.message
    });
  }
});

/**
 * Obtener status de mensaje
 * GET /messages/:messageId/status
 */
router.get('/:messageId/status', async (req, res) => {
  const { messageId } = req.params;

  const db = new sqlite3.Database(DB_PATH);

  try {
    const message = await new Promise((resolve, reject) => {
      db.get(
        'SELECT id, status, sent_at, delivered_at, read_at FROM messages WHERE id = ?',
        [messageId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (!message) {
      db.close();
      return res.status(404).json({
        success: false,
        error: 'Mensaje no encontrado'
      });
    }

    db.close();

    res.json({
      success: true,
      data: {
        messageId: message.id,
        status: message.status,
        icon: getStatusIcon(message.status),
        color: getStatusColor(message.status),
        timestamps: {
          sent: message.sent_at,
          delivered: message.delivered_at,
          read: message.read_at
        }
      }
    });

  } catch (error) {
    logger.error('❌ Error obteniendo status:', error);
    db.close();
    
    res.status(500).json({
      success: false,
      error: 'Error al obtener status: ' + error.message
    });
  }
});

/**
 * Actualizar status por WAMAID (desde webhook)
 * POST /messages/wamaid/:wamaid/status
 */
router.post('/wamaid/:wamaid/status', async (req, res) => {
  const { wamaid } = req.params;
  const { status } = req.body;

  if (!wamaid || !status) {
    return res.status(400).json({
      success: false,
      error: 'wamaid y status son requeridos'
    });
  }

  const db = new sqlite3.Database(DB_PATH);

  try {
    const message = await new Promise((resolve, reject) => {
      db.get(
        'SELECT id, status FROM messages WHERE message_id = ?',
        [wamaid],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (!message) {
      db.close();
      return res.status(404).json({
        success: false,
        error: 'Mensaje no encontrado con ese WAMAID'
      });
    }

    let updateColumn = '';
    switch (status) {
      case 'sent':
        updateColumn = 'sent_at';
        break;
      case 'delivered':
        updateColumn = 'delivered_at';
        break;
      case 'read':
        updateColumn = 'read_at';
        break;
      case 'failed':
        updateColumn = 'failed_at';
        break;
    }

    await new Promise((resolve, reject) => {
      db.run(
        `UPDATE messages SET status = ?, ${updateColumn} = ? WHERE id = ?`,
        [status, new Date().toISOString(), message.id],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    logger.info(`✅ Mensaje ${wamaid} actualizado a status: ${status}`);

    db.close();

    res.json({
      success: true,
      message: `Status actualizado a: ${status}`,
      data: {
        messageId: message.id,
        wamaid,
        status,
        icon: getStatusIcon(status),
        color: getStatusColor(status)
      }
    });

  } catch (error) {
    logger.error('❌ Error actualizando status por WAMAID:', error);
    db.close();
    
    res.status(500).json({
      success: false,
      error: 'Error al actualizar status: ' + error.message
    });
  }
});

function getStatusIcon(status) {
  switch (status) {
    case 'sent':
      return '✓';
    case 'delivered':
      return '✓✓';
    case 'read':
      return '✓✓';
    case 'failed':
      return '✗';
    default:
      return '⏱';
  }
}

function getStatusColor(status) {
  switch (status) {
    case 'sent':
      return '#999999';
    case 'delivered':
      return '#999999';
    case 'read':
      return '#007bff';
    case 'failed':
      return '#dc3545';
    default:
      return '#999999';
  }
}

export default router;

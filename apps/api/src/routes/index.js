/**
 * Rutas principales de la API unificada para 360dialog
 */

import express from 'express';
import fs from 'fs';
import path from 'path';
import { createLocalDB } from '../core/localDB.js';
import contactsRouter from './contacts.js';
import messagingRouter from './messaging.js';
import callingRouter from './calling.js';
import systemRouter from './system.js';
import flowsRouter from './flows.js';
import templatePacingRouter from './templatePacing.js';
import partnerAPIRouter from './partnerAPI.js';
import templateStatusRouter from './templateStatus.js';
import clientHubRouter from './clientHub.js';

export function createApiRouter(io) {
  const router = express.Router();
  const db = createLocalDB();

  // Usar routers con prefijos organizados
  router.use('/contacts', contactsRouter);
  router.use('/messaging', messagingRouter);
  router.use('/calling', callingRouter);
  router.use('/system', systemRouter);
  router.use('/flows', flowsRouter);
  router.use('/template-pacing', templatePacingRouter);
  router.use('/partner', partnerAPIRouter);
  router.use('/template-status', templateStatusRouter);
  router.use('/client-hub', clientHubRouter);

  // Rutas básicas de sistema
  router.get('/inbox', (req, res) => {
    try {
      res.json(db.inboxSnapshot());
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/health', (req, res) => {
    try {
      res.json(db.health());
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Endpoint de estadísticas del dashboard
  router.get('/dashboard/stats', (req, res) => {
    try {
      const stats = {
        totalMessages: 0,
        activeContacts: 0,
        templatesCount: 0,
        systemStatus: 'active'
      };
      
      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Error getting dashboard stats:', error);
      res.status(500).json({
        success: false,
        error: 'Error getting dashboard stats',
        details: error.message
      });
    }
  });

  // Endpoints para servir datos desde SQLite
  router.get('/data/messages', (req, res) => {
    try {
      const db = createLocalDB();
      const messages = db.prepare(`
        SELECT * FROM messages 
        ORDER BY created_at DESC 
        LIMIT 100
      `).all();
      
      res.json(messages);
    } catch (error) {
      console.error('Error serving messages data:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.get('/data/contacts', (req, res) => {
    try {
      const db = createLocalDB();
      const contacts = db.prepare(`
        SELECT DISTINCT 
          phone_number,
          contact_name,
          MAX(created_at) as last_message_time,
          COUNT(*) as message_count
        FROM messages 
        GROUP BY phone_number
        ORDER BY last_message_time DESC
      `).all();
      
      res.json(contacts);
    } catch (error) {
      console.error('Error serving contacts data:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Ruta de información del sistema
  router.get('/info', (req, res) => {
    res.json({
      name: 'WhatsApp Bot API - 360dialog',
      version: '2.0.0',
      provider: '360dialog',
      features: [
        'Mensajería unificada',
        'Llamadas VoIP',
        'Templates',
        'Mensajes interactivos',
        'Gestión de contactos',
        'Webhooks',
        'Integración ManyChat',
        'IA conversacional',
      ],
      endpoints: {
        contacts: '/api/contacts',
        messaging: '/api/messaging',
        calling: '/api/calling',
        webhooks: '/webhooks',
      },
    });
  });

  return { router, db };
}

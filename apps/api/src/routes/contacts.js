/**
 * Router de gestión de contactos
 * Migrado y unificado para 360dialog
 */

import express from 'express';
import { createLocalDB } from '../core/localDB.js';
import { log } from '../core/logger.js';

const router = express.Router();
const db = createLocalDB();

// ===== API GESTIÓN DE CONTACTOS =====

// GET /api/contacts/:phone - Obtener contacto específico
router.get('/:phone', (req, res) => {
  try {
    const phone = req.params.phone;
    const contact = db.getContact(phone);

    if (!contact) {
      return res.status(404).json({ error: 'Contacto no encontrado' });
    }

    res.json(contact);
  } catch (error) {
    log(`❌ Error obteniendo contacto: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/contacts/:phone/tag - Agregar tag a contacto
router.post('/:phone/tag', (req, res) => {
  try {
    const phone = req.params.phone;
    const { tag } = req.body;

    if (!tag) {
      return res.status(400).json({ error: 'Falta el tag' });
    }

    const contact = db.getContact(phone) || {
      last_seen: new Date().toISOString(),
      last_text: '',
      tags: [],
      fields: {},
    };

    if (!contact.tags.includes(tag)) {
      contact.tags.push(tag);
    }

    db.setContact(phone, contact);
    db.saveContacts();

    // Emitir actualización via Socket.IO
    if (global.io) {
      global.io.emit('inbox_snapshot', db.inboxSnapshot());
    }

    res.json(contact);
  } catch (error) {
    log(`❌ Error agregando tag: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/contacts/:phone/tag - Remover tag de contacto
router.delete('/:phone/tag', (req, res) => {
  try {
    const phone = req.params.phone;
    const { tag } = req.body;

    if (!tag) {
      return res.status(400).json({ error: 'Falta el tag' });
    }

    const contact = db.getContact(phone);
    if (contact) {
      contact.tags = contact.tags.filter(t => t !== tag);
      db.setContact(phone, contact);
      db.saveContacts();

      // Emitir actualización via Socket.IO
      if (global.io) {
        global.io.emit('inbox_snapshot', db.inboxSnapshot());
      }
    }

    res.json(contact || null);
  } catch (error) {
    log(`❌ Error removiendo tag: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/contacts/:phone/field - Establecer campo personalizado
router.post('/:phone/field', (req, res) => {
  try {
    const phone = req.params.phone;
    const { field, value } = req.body;

    if (!field || value === undefined) {
      return res.status(400).json({ error: 'Faltan field o value' });
    }

    const contact = db.getContact(phone) || {
      last_seen: new Date().toISOString(),
      last_text: '',
      tags: [],
      fields: {},
    };

    contact.fields[field] = value;
    db.setContact(phone, contact);
    db.saveContacts();

    // Emitir actualización via Socket.IO
    if (global.io) {
      global.io.emit('inbox_snapshot', db.inboxSnapshot());
    }

    res.json(contact);
  } catch (error) {
    log(`❌ Error estableciendo campo: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/contacts/inbox - Obtener bandeja de entrada
router.get('/inbox', (req, res) => {
  try {
    res.json(db.inboxSnapshot());
  } catch (error) {
    log(`❌ Error obteniendo inbox: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/contacts/history - Obtener historial de conversación
router.get('/history', (req, res) => {
  try {
    const phone = req.query.phone;
    if (!phone) {
      return res.json([]);
    }

    res.json(db.ensureConv(phone));
  } catch (error) {
    log(`❌ Error obteniendo historial: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

export default router;

/**
 * Router de llamadas unificado para 360dialog
 * Consolida todas las operaciones de llamadas
 */

import express from 'express';
import { unified360DialogService } from '../../../../src/services/core/core/Unified360DialogService.js';
import { createLocalDB } from '../core/localDB.js';
import { log } from '../core/logger.js';

const router = express.Router();
const db = createLocalDB();

// POST /api/calling/make-call - Realizar llamada saliente
router.post('/make-call', async (req, res) => {
  try {
    const { to } = req.body;

    if (!to) {
      return res.status(400).json({ error: 'Falta parámetro: to' });
    }

    const result = await unified360DialogService.makeCall(to);

    // Registrar llamada en base de datos local
    db.addCallLog(to, 'outgoing', 'initiated');

    // Emitir evento via Socket.IO
    if (global.io) {
      global.io.emit('call_initiated', { to, callId: result.id });
    }

    res.json({ success: true, data: result });
  } catch (error) {
    log(`❌ Error iniciando llamada: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/calling/status/:callId - Obtener estado de llamada
router.get('/status/:callId', async (req, res) => {
  try {
    const { callId } = req.params;

    const status = await unified360DialogService.getCallStatus(callId);

    res.json({ success: true, data: status });
  } catch (error) {
    log(`❌ Error obteniendo estado de llamada: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/calling/terminate/:callId - Terminar llamada
router.post('/terminate/:callId', async (req, res) => {
  try {
    const { callId } = req.params;

    const result = await unified360DialogService.terminateCall(callId);

    // Emitir evento via Socket.IO
    if (global.io) {
      global.io.emit('call_terminated', { callId });
    }

    res.json({ success: true, data: result });
  } catch (error) {
    log(`❌ Error terminando llamada: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/calling/pre-accept - Pre-aceptar llamada
router.post('/pre-accept', async (req, res) => {
  try {
    const { callId } = req.body;

    if (!callId) {
      return res.status(400).json({ error: 'Falta parámetro: callId' });
    }

    // Lógica de pre-aceptación (WebRTC setup)
    log(`📞 Pre-aceptando llamada: ${callId}`);

    res.json({ success: true, message: 'Llamada pre-aceptada' });
  } catch (error) {
    log(`❌ Error pre-aceptando llamada: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/calling/accept - Aceptar llamada
router.post('/accept', async (req, res) => {
  try {
    const { callId } = req.body;

    if (!callId) {
      return res.status(400).json({ error: 'Falta parámetro: callId' });
    }

    // Lógica de aceptación de llamada
    log(`📞 Aceptando llamada: ${callId}`);

    // Emitir evento via Socket.IO
    if (global.io) {
      global.io.emit('call_accepted', { callId });
    }

    res.json({ success: true, message: 'Llamada aceptada' });
  } catch (error) {
    log(`❌ Error aceptando llamada: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/calling/reject - Rechazar llamada
router.post('/reject', async (req, res) => {
  try {
    const { callId } = req.body;

    if (!callId) {
      return res.status(400).json({ error: 'Falta parámetro: callId' });
    }

    // Lógica de rechazo de llamada
    log(`📞 Rechazando llamada: ${callId}`);

    // Emitir evento via Socket.IO
    if (global.io) {
      global.io.emit('call_rejected', { callId });
    }

    res.json({ success: true, message: 'Llamada rechazada' });
  } catch (error) {
    log(`❌ Error rechazando llamada: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/calling/ice-candidate - Manejar ICE candidates
router.post('/ice-candidate', async (req, res) => {
  try {
    const { callId, candidate } = req.body;

    if (!callId || !candidate) {
      return res
        .status(400)
        .json({ error: 'Faltan parámetros: callId, candidate' });
    }

    // Manejar ICE candidate para WebRTC
    log(`🧊 ICE candidate para llamada: ${callId}`);

    // Emitir evento via Socket.IO
    if (global.io) {
      global.io.emit('ice_candidate', { callId, candidate });
    }

    res.json({ success: true, message: 'ICE candidate procesado' });
  } catch (error) {
    log(`❌ Error procesando ICE candidate: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/calling/conversation-requirements - Obtener requisitos de conversación
router.get('/conversation-requirements', async (req, res) => {
  try {
    const requirements = {
      min_conversations: 1000,
      current_status: 'active',
      calling_enabled: true,
    };

    res.json({ success: true, data: requirements });
  } catch (error) {
    log(`❌ Error obteniendo requisitos: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

export default router;

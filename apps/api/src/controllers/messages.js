import express from 'express';

export default function createMessagesController(db, io) {
  const router = express.Router();

  router.get('/messages', (req, res) => {
    const messages = db.read('messages');
    res.json(messages);
  });

  router.get('/history', (req, res) => {
    const phone = req.query.phone;
    if (!phone) return res.json([]);
    const out = db.getHistoryByPhone(phone);
    res.json(out);
  });

  // Permite insertar mensajes manualmente (útil para pruebas)
  router.post('/messages', (req, res) => {
    const m = req.body || {};
    if (!m.id) m.id = `local-${Date.now()}`;
    if (!m.ts) m.ts = Date.now();
    db.ensureMessage(m.id, m);
    if (io) io.emit('new_message', m);
    res.json({ ok: true, message: m });
  });

  return router;
}

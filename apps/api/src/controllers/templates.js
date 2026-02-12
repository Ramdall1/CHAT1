import express from 'express';

export default function createTemplatesController(db) {
  const router = express.Router();

  // Plantillas locales en /data/templates.json
  router.get('/templates', (req, res) => {
    const templates = db.read('templates');
    res.json({ templates });
  });

  router.post('/templates', (req, res) => {
    const { name, language, components } = req.body || {};
    if (!name) return res.status(400).json({ error: 'Falta name' });
    const templates = db.read('templates');
    if (!templates.find(t => t.name === name))
      templates.push({ name, language, components });
    db.write('templates', templates);
    res.json({ ok: true });
  });

  return router;
}

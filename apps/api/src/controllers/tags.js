import express from 'express';

export default function createTagsController(db) {
  const router = express.Router();

  router.get('/tags', (req, res) => {
    const tags = db.read('tags');
    res.json(tags);
  });

  router.post('/tags', (req, res) => {
    const { name } = req.body || {};
    if (!name) return res.status(400).json({ error: 'Falta name' });
    const tags = db.read('tags');
    if (!tags.find(t => t.name === name)) tags.push({ name });
    db.write('tags', tags);
    res.json({ ok: true });
  });

  router.put('/tags/:name', (req, res) => {
    const name = req.params.name;
    const { newName } = req.body || {};
    const tags = db.read('tags');
    const idx = tags.findIndex(t => t.name === name);
    if (idx < 0) return res.status(404).json({ error: 'Tag no encontrado' });
    tags[idx].name = newName || name;
    db.write('tags', tags);
    res.json({ ok: true });
  });

  router.delete('/tags/:name', (req, res) => {
    const name = req.params.name;
    const tags = db.read('tags').filter(t => t.name !== name);
    db.write('tags', tags);
    res.json({ ok: true });
  });

  return router;
}

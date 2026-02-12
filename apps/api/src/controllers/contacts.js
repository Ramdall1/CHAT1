import express from 'express';

export default function createContactsController(db, search) {
  const router = express.Router();

  router.get('/contacts', (req, res) => {
    const contacts = db.read('contacts');
    res.json(contacts);
  });

  router.get('/contacts/search', (req, res) => {
    const { keyword, country, tag, dateFrom, dateTo } = req.query;
    const snapshot = db.inboxSnapshot();
    const out = search.filterBy(snapshot, {
      keyword,
      country,
      tag,
      dateFrom,
      dateTo,
    });
    res.json(out);
  });

  router.post('/contacts', (req, res) => {
    const { phone, name, tags, fields } = req.body || {};
    if (!phone) return res.status(400).json({ error: 'Falta phone' });
    db.upsertContact({ phone, name, tags, fields });
    res.json({ ok: true });
  });

  router.put('/contacts/:phone', (req, res) => {
    const phone = req.params.phone;
    const { name, tags, fields } = req.body || {};
    db.upsertContact({ phone, name, tags, fields });
    res.json({ ok: true });
  });

  router.post('/contacts/:phone/tag', (req, res) => {
    const phone = req.params.phone;
    const { tag } = req.body || {};
    if (!tag) return res.status(400).json({ error: 'Falta tag' });
    const ok = db.addTag(phone, tag);
    res.json({ ok });
  });

  router.delete('/contacts/:phone/tag', (req, res) => {
    const phone = req.params.phone;
    const { tag } = req.body || {};
    if (!tag) return res.status(400).json({ error: 'Falta tag' });
    const ok = db.removeTag(phone, tag);
    res.json({ ok });
  });

  router.post('/contacts/import', (req, res) => {
    const { contacts } = req.body || {};
    if (!Array.isArray(contacts))
      return res.status(400).json({ error: 'Formato inválido: contacts[]' });
    const existing = db.read('contacts');
    const map = new Map(existing.map(c => [String(c.phone), c]));
    contacts.forEach(c => {
      const phone = String(c.phone);
      const prev = map.get(phone) || { phone };
      map.set(phone, { ...prev, ...c });
    });
    db.write('contacts', Array.from(map.values()));
    res.json({ ok: true, imported: contacts.length });
  });

  router.get('/contacts/export', (req, res) => {
    const { tag } = req.query || {};
    let contacts = db.read('contacts');
    if (tag)
      contacts = contacts.filter(
        c => Array.isArray(c.tags) && c.tags.includes(tag)
      );
    res.json({ contacts });
  });

  router.get('/segments', (req, res) => {
    const segments = db.read('segments');
    res.json({ segments });
  });

  return router;
}

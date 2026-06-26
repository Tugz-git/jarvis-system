const express = require('express');
const router = express.Router();
const memory = require('../memory/memory');

router.get('/', (req, res) => res.json(memory.getAllMemory()));
router.post('/fact', (req, res) => {
  const { key, value } = req.body;
  if (!key) return res.status(400).json({ error: 'key required' });
  memory.setFact(key, value);
  res.json({ ok: true });
});
router.get('/fact/:key', (req, res) => {
  res.json({ value: memory.getFact(req.params.key) });
});
router.delete('/conversations', (req, res) => {
  memory.clearConversations();
  res.json({ ok: true });
});

module.exports = router;

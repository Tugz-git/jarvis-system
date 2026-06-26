const express = require('express');
const router = express.Router();
const { exec } = require('child_process');
const { getDb } = require('../db/database');

function requireApproval(req, res, next) {
  if (!req.body.approved) {
    return res.status(403).json({
      error: 'PERMISSION REQUIRED',
      message: 'Sir, automation requires your explicit approval. Set approved: true to confirm.'
    });
  }
  next();
}

// Safe whitelist of allowed command patterns
const SAFE_PATTERNS = [
  /^open\s+.+/i,
  /^xdg-open\s+.+/i,
  /^start\s+.+/i,
  /^vol(ume)?\s+\d+/i,
  /^notify-send\s+.+/i,
  /^wmctrl\s+.+/i,
  /^pactl\s+set-sink-volume\s+.+/i,
  /^osascript\s+-e\s+.+/i  // macOS
];

function isSafeCommand(cmd) {
  return SAFE_PATTERNS.some(p => p.test(cmd.trim()));
}

router.post('/run', requireApproval, (req, res) => {
  const { command } = req.body;
  if (!command) return res.status(400).json({ error: 'command required' });
  
  if (!isSafeCommand(command)) {
    return res.status(403).json({ 
      error: 'COMMAND BLOCKED', 
      message: `Sir, "${command}" is not in the safe command whitelist.` 
    });
  }

  const db = getDb();
  const stmt = db.prepare('INSERT INTO commands (command, approved) VALUES (?, 1)');
  const { lastInsertRowid } = stmt.run(command);

  exec(command, { timeout: 10000 }, (err, stdout, stderr) => {
    const result = err ? (stderr || err.message) : (stdout || 'Done');
    db.prepare('UPDATE commands SET result=?, executed=1 WHERE id=?').run(result, lastInsertRowid);
    res.json({ ok: !err, result, command });
  });
});

// Alert management
router.get('/alerts', (req, res) => {
  const db = getDb();
  const alerts = db.prepare('SELECT * FROM alerts ORDER BY created_at DESC LIMIT 50').all();
  res.json(alerts);
});

router.post('/alert', (req, res) => {
  const { type, message, severity = 'info' } = req.body;
  const db = getDb();
  db.prepare('INSERT INTO alerts (type, message, severity) VALUES (?, ?, ?)').run(type, message, severity);
  res.json({ ok: true });
});

router.post('/alert/:id/resolve', (req, res) => {
  const db = getDb();
  db.prepare('UPDATE alerts SET resolved=1 WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// Tasks
router.get('/tasks', (req, res) => {
  const db = getDb();
  res.json(db.prepare('SELECT * FROM tasks ORDER BY created_at DESC').all());
});

router.post('/tasks', (req, res) => {
  const { title, description, priority = 'normal' } = req.body;
  const db = getDb();
  const { lastInsertRowid } = db.prepare('INSERT INTO tasks (title, description, priority) VALUES (?, ?, ?)').run(title, description, priority);
  res.json({ ok: true, id: lastInsertRowid });
});

router.patch('/tasks/:id', (req, res) => {
  const { status } = req.body;
  const db = getDb();
  db.prepare('UPDATE tasks SET status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?').run(status, req.params.id);
  res.json({ ok: true });
});

module.exports = router;

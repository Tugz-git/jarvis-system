const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

// All file operations require explicit approval flag
function requireApproval(req, res, next) {
  if (!req.body.approved) {
    return res.status(403).json({ 
      error: 'PERMISSION REQUIRED', 
      message: 'Sir, this action requires your explicit approval. Set approved: true to confirm.' 
    });
  }
  next();
}

// List directory
router.get('/list', (req, res) => {
  const dir = req.query.path || process.env.HOME || '/';
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    res.json(entries.map(e => ({ name: e.name, isDir: e.isDirectory(), path: path.join(dir, e.name) })));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Read file
router.get('/read', (req, res) => {
  const filePath = req.query.path;
  if (!filePath) return res.status(400).json({ error: 'path required' });
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    res.json({ content, path: filePath });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Create/write file — requires approval
router.post('/write', requireApproval, (req, res) => {
  const { filePath, content } = req.body;
  if (!filePath) return res.status(400).json({ error: 'filePath required' });
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content || '');
    res.json({ ok: true, message: `File written: ${filePath}` });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Delete file — requires approval
router.delete('/delete', requireApproval, (req, res) => {
  const { filePath } = req.body;
  if (!filePath) return res.status(400).json({ error: 'filePath required' });
  try {
    fs.rmSync(filePath, { recursive: true, force: true });
    res.json({ ok: true, message: `Deleted: ${filePath}` });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

module.exports = router;

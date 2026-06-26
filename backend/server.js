require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { WebSocketServer } = require('ws');
const http = require('http');
const { authMiddleware, login, ensureDefaultUser } = require('./auth/auth');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(cors());
app.use(express.json());

// Auth login route (public)
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  const token = login(username, password);
  if (!token) return res.status(401).json({ error: 'Invalid credentials' });
  res.json({ token });
});

// Health check endpoint (public — must be before auth middleware)
app.get('/api/status', (req, res) => {
  res.json({ status: 'ONLINE', version: '0.0.1', timestamp: new Date().toISOString() });
});

// Protect all /api routes except login
app.use('/api', (req, res, next) => {
  if (req.path === '/auth/login') return next();
  authMiddleware(req, res, next);
});

// Serve frontend (public)
app.use(express.static(path.join(__dirname, '../frontend')));

// Routes
const aiRoutes = require('./routes/ai');
const systemRoutes = require('./routes/system');
const memoryRoutes = require('./routes/memory');
const filesRoutes = require('./routes/files');
const automationRoutes = require('./routes/automation');

app.use('/api/ai', aiRoutes);
app.use('/api/system', systemRoutes);
app.use('/api/memory', memoryRoutes);
app.use('/api/files', filesRoutes);
app.use('/api/automation', automationRoutes);

// Catch-all → frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// WebSocket — verify token
wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const token = url.searchParams.get('token');
  const jwt = require('jsonwebtoken');
  const SECRET = process.env.JWT_SECRET || 'jarvis-secret-change-me';
  try { jwt.verify(token, SECRET); } catch { ws.close(); return; }

  console.log('[JARVIS] Authenticated WebSocket connected');
  const si = require('systeminformation');
  const interval = setInterval(async () => {
    try {
      const [cpu, mem, net, disk] = await Promise.all([
        si.currentLoad(), si.mem(), si.networkStats(), si.fsSize()
      ]);
      if (ws.readyState === 1) {
        ws.send(JSON.stringify({
          type: 'stats',
          cpu: Math.round(cpu.currentLoad),
          memory: Math.round((mem.used / mem.total) * 100),
          network: Math.round((net[0]?.rx_sec || 0) / 1024),
          disk: disk[0] ? Math.round((disk[0].used / disk[0].size) * 100) : 0
        }));
      }
    } catch {}
  }, 2000);
  ws.on('close', () => clearInterval(interval));
});

ensureDefaultUser();
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`[JARVIS] Online — http://localhost:${PORT}`);
});

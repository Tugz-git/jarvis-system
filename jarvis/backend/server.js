require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { WebSocketServer } = require('ws');
const http = require('http');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(cors());
app.use(express.json());
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

// Health check
app.get('/api/status', (req, res) => {
  res.json({ status: 'ONLINE', version: '0.0.1', timestamp: new Date().toISOString() });
});

// WebSocket for real-time system stats
wss.on('connection', (ws) => {
  console.log('[JARVIS] WebSocket client connected');
  const si = require('systeminformation');

  const interval = setInterval(async () => {
    try {
      const [cpu, mem, net, disk] = await Promise.all([
        si.currentLoad(),
        si.mem(),
        si.networkStats(),
        si.fsSize()
      ]);
      if (ws.readyState === 1) {
        ws.send(JSON.stringify({
          type: 'stats',
          cpu: Math.round(cpu.currentLoad),
          memory: Math.round((mem.used / mem.total) * 100),
          network: net[0] ? Math.round((net[0].rx_sec || 0) / 1024) : 0,
          disk: disk[0] ? Math.round((disk[0].used / disk[0].size) * 100) : 0,
          timestamp: Date.now()
        }));
      }
    } catch (e) {}
  }, 2000);

  ws.on('close', () => clearInterval(interval));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`[JARVIS] Neural Operating System ONLINE — http://localhost:${PORT}`);
});

module.exports = { app, wss };

const express = require('express');
const router = express.Router();
const si = require('systeminformation');

router.get('/stats', async (req, res) => {
  try {
    const [cpu, mem, net, disk, osInfo, battery] = await Promise.all([
      si.currentLoad(),
      si.mem(),
      si.networkStats(),
      si.fsSize(),
      si.osInfo(),
      si.battery().catch(() => ({ hasBattery: false }))
    ]);
    res.json({
      cpu: Math.round(cpu.currentLoad),
      memory: { used: Math.round((mem.used / mem.total) * 100), total: Math.round(mem.total / 1073741824) },
      network: { rx: Math.round((net[0]?.rx_sec || 0) / 1024), tx: Math.round((net[0]?.tx_sec || 0) / 1024) },
      disk: disk.map(d => ({ fs: d.fs, use: Math.round((d.used / d.size) * 100) })),
      os: { platform: osInfo.platform, distro: osInfo.distro, hostname: osInfo.hostname },
      battery
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/processes', async (req, res) => {
  try {
    const procs = await si.processes();
    const top = procs.list.sort((a, b) => b.cpu - a.cpu).slice(0, 10);
    res.json(top);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;

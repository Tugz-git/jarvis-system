// J.A.R.V.I.S. Main Application Logic
'use strict';

const API = '';  // Same origin

// ── STATE ──
let currentMode = 'standby'; // standby | talking | alert | research
let wsConn = null;
let recognition = null;
let isListening = false;
let ttsQueue = [];
let ttsPlaying = false;
let permResolve = null;
let webcamStream = null;
let detailsVisible = false;
const taskCache = [];

// ── INIT ──
document.addEventListener('DOMContentLoaded', () => {
  updateClock();
  setInterval(updateClock, 1000);
  connectWS();
  loadTasks();
  setupChat();
  setupWebcam();
  setupVoice();
  setMode('standby');

  // Focus chat input on any key
  document.addEventListener('keydown', e => {
    const inp = document.getElementById('chat-input');
    if (e.key === 'Enter' && document.activeElement !== inp) inp.focus();
    if (document.activeElement === inp && e.key === 'Enter') sendMessage();
  });
});

// ── CLOCK ──
function updateClock() {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2,'0');
  const mm = String(now.getMinutes()).padStart(2,'0');
  document.getElementById('clock-time').textContent = `${hh}:${mm}`;
  document.getElementById('hdr-time').textContent = `${hh}:${mm}`;
  document.getElementById('clock-date').textContent = now.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',year:'numeric'}).toUpperCase();
}

// ── MODE MANAGEMENT ──
function setMode(m) {
  currentMode = m;
  document.body.className = m;
  const badge = document.getElementById('mode-badge');
  const modes = { standby:'STANDBY', talking:'ACTIVE', alert:'⚠ ALERT', research:'RESEARCHING' };
  badge.textContent = modes[m] || m.toUpperCase();

  switch(m) {
    case 'standby':
      Sphere.setMode('standby'); Sphere.setEnergy(0.1);
      document.getElementById('chat-area').classList.add('hidden');
      document.getElementById('standby-clock').style.opacity = '1';
      break;
    case 'talking':
      Sphere.setMode('talking'); Sphere.setEnergy(0.5);
      document.getElementById('chat-area').classList.remove('hidden');
      document.getElementById('standby-clock').style.opacity = '0';
      break;
    case 'alert':
      Sphere.setMode('alert'); Sphere.setEnergy(1);
      break;
    case 'research':
      Sphere.setMode('research'); Sphere.setEnergy(0.7);
      break;
  }
}

// ── WEBSOCKET (live stats) ──
function connectWS() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  wsConn = new WebSocket(`${proto}://${location.host}`);
  wsConn.onmessage = (e) => {
    try {
      const d = JSON.parse(e.data);
      if (d.type === 'stats') updateStats(d);
    } catch {}
  };
  wsConn.onclose = () => setTimeout(connectWS, 3000);
}

function updateStats(d) {
  setRing('cpu', d.cpu, `${d.cpu}%`);
  setRing('mem', d.memory, `${d.memory}%`);
  const netPct = Math.min(d.network, 100);
  setRing('net', netPct, `${d.network}k`);
  setRing('disk', d.disk, `${d.disk}%`);
  // Energy from CPU
  Sphere.setEnergy(0.1 + (d.cpu / 100) * 0.6 + (currentMode === 'talking' ? 0.3 : 0));
}

function setRing(id, pct, label) {
  const r = 32;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  const ring = document.getElementById(`ring-${id}`);
  const val = document.getElementById(`val-${id}`);
  if (ring) ring.style.strokeDashoffset = offset;
  if (val) val.textContent = label;
}

// ── CHAT ──
function setupChat() {
  document.getElementById('send-btn').addEventListener('click', sendMessage);
  document.getElementById('chat-input').addEventListener('click', () => {
    if (currentMode === 'standby') setMode('talking');
  });
}

async function sendMessage(textOverride) {
  const input = document.getElementById('chat-input');
  const text = textOverride || input.value.trim();
  if (!text) return;
  input.value = '';
  if (currentMode === 'standby') setMode('talking');

  addMessage('user', text);
  showSubtitle('Processing...');
  Sphere.pulse();

  try {
    const res = await fetch(`${API}/api/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text })
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);

    document.getElementById('provider-badge').textContent = `AI: ${data.provider?.toUpperCase() || 'GEMINI'}`;
    addMessage('jarvis', data.reply);
    showSubtitle(data.reply.slice(0, 120) + (data.reply.length > 120 ? '…' : ''));
    speakText(data.reply);
  } catch (e) {
    addMessage('jarvis', `I encountered an error, Sir: ${e.message}`);
  }
}

function addMessage(role, text) {
  const msgs = document.getElementById('chat-messages');
  const div = document.createElement('div');
  div.className = `msg msg-${role}`;
  div.textContent = text;
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
}

function showSubtitle(text) {
  const sub = document.getElementById('subtitle-bar');
  sub.textContent = text;
  sub.classList.add('visible');
  clearTimeout(sub._t);
  sub._t = setTimeout(() => sub.classList.remove('visible'), 6000);
}

// ── TTS — Web Speech API (best JARVIS-like voice) ──
function speakText(text) {
  if (!window.speechSynthesis) return;
  // Clean markdown
  const clean = text.replace(/\*\*/g,'').replace(/\*/g,'').replace(/#+/g,'').slice(0,400);
  const utter = new SpeechSynthesisUtterance(clean);
  utter.rate = 0.92;
  utter.pitch = 0.85;
  utter.volume = 1;

  // Try to pick a deep, British-ish voice
  const voices = speechSynthesis.getVoices();
  const preferred = voices.find(v => /daniel|george|james|brian|male/i.test(v.name) && /en/i.test(v.lang))
    || voices.find(v => /en/i.test(v.lang) && v.gender !== 'female')
    || voices[0];
  if (preferred) utter.voice = preferred;

  utter.onstart = () => { Sphere.setEnergy(0.8); };
  utter.onend = () => { Sphere.setEnergy(0.3); };
  speechSynthesis.speak(utter);
}

// Reload voices (Chrome lazy-loads them)
if (window.speechSynthesis) {
  speechSynthesis.onvoiceschanged = () => {};
}

// ── VOICE INPUT ──
function setupVoice() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    document.getElementById('mic-btn').style.opacity = '0.3';
    document.getElementById('mic-btn').title = 'Voice not supported in this browser';
    return;
  }
  recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = 'en-US';

  recognition.onresult = (e) => {
    const transcript = e.results[0][0].transcript;
    document.getElementById('chat-input').value = transcript;
    sendMessage();
  };
  recognition.onend = () => {
    isListening = false;
    document.getElementById('mic-btn').classList.remove('listening');
  };

  document.getElementById('mic-btn').addEventListener('click', () => {
    if (isListening) { recognition.stop(); return; }
    isListening = true;
    document.getElementById('mic-btn').classList.add('listening');
    if (currentMode === 'standby') setMode('talking');
    recognition.start();
  });
}

// ── WEBCAM ──
function setupWebcam() {
  document.getElementById('cam-toggle').addEventListener('click', toggleWebcam);
}

async function toggleWebcam() {
  const btn = document.getElementById('cam-toggle');
  const video = document.getElementById('webcam');
  if (webcamStream) {
    webcamStream.getTracks().forEach(t => t.stop());
    webcamStream = null;
    video.srcObject = null;
    btn.textContent = 'ACTIVATE';
    return;
  }
  try {
    webcamStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    video.srcObject = webcamStream;
    btn.textContent = 'DEACTIVATE';
    startIntruderWatch();
  } catch (e) {
    showAlert(`Webcam: ${e.message}`, 'warning');
  }
}

// Basic motion intruder detection
function startIntruderWatch() {
  const video = document.getElementById('webcam');
  const canvas = document.createElement('canvas');
  canvas.width = 160; canvas.height = 90;
  const c = canvas.getContext('2d');
  let prevData = null;
  let alertTimer = null;

  setInterval(() => {
    if (!webcamStream) return;
    c.drawImage(video, 0, 0, 160, 90);
    const frame = c.getImageData(0, 0, 160, 90).data;
    if (prevData) {
      let diff = 0;
      for (let i = 0; i < frame.length; i += 4) {
        diff += Math.abs(frame[i] - prevData[i]);
      }
      const motion = diff / (160 * 90);
      if (motion > 25) {
        if (!alertTimer) {
          alertTimer = setTimeout(() => {
            triggerIntruderAlert();
            alertTimer = null;
          }, 4000);
        }
      } else {
        clearTimeout(alertTimer);
        alertTimer = null;
      }
    }
    prevData = new Uint8ClampedArray(frame);
  }, 500);
}

function triggerIntruderAlert() {
  setMode('alert');
  showAlertBanner('⚠ INTRUDER DETECTED — VISUAL ANOMALY FLAGGED — AWAITING BIOMETRIC CONFIRMATION');
  Sphere.setMode('alert');
  Sphere.setEnergy(1);
  speakText('Sir, I have detected an unrecognized presence at the workstation. Locking interface and alerting you now.');
  // Log alert
  fetch(`${API}/api/automation/alert`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'intruder', message: 'Motion/visual anomaly detected at workstation', severity: 'critical' })
  }).catch(() => {});
}

// ── ALERTS ──
function showAlertBanner(msg) {
  const banner = document.getElementById('alert-banner');
  document.getElementById('alert-text').textContent = msg;
  banner.classList.remove('hidden');
}

function dismissAlert() {
  document.getElementById('alert-banner').classList.add('hidden');
  if (currentMode === 'alert') setMode('standby');
  Sphere.setMode('standby');
}

function showAlert(msg, severity = 'info') {
  console.log(`[JARVIS ALERT] ${msg}`);
}

// ── TASKS ──
async function loadTasks() {
  try {
    const res = await fetch(`${API}/api/automation/tasks`);
    const tasks = await res.json();
    renderTasks(tasks);
  } catch (e) {}
}

function renderTasks(tasks) {
  const list = document.getElementById('task-list');
  list.innerHTML = '';
  tasks.forEach(t => {
    const div = document.createElement('div');
    div.className = `task-item task-${t.priority}`;
    div.innerHTML = `<div class="task-title">${t.title}</div><div class="task-status">${t.status.toUpperCase()} · ${t.priority.toUpperCase()}</div>`;
    div.onclick = () => cycleTaskStatus(t.id, t.status);
    list.appendChild(div);
  });
}

async function cycleTaskStatus(id, current) {
  const next = { pending: 'active', active: 'done', done: 'pending' };
  await fetch(`${API}/api/automation/tasks/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: next[current] || 'active' })
  });
  loadTasks();
}

function showAddTask() {
  document.getElementById('task-modal').classList.remove('hidden');
}
function closeTaskModal() {
  document.getElementById('task-modal').classList.add('hidden');
}
async function submitTask() {
  const title = document.getElementById('task-title-inp').value.trim();
  if (!title) return;
  await fetch(`${API}/api/automation/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title,
      description: document.getElementById('task-desc-inp').value,
      priority: document.getElementById('task-pri-inp').value
    })
  });
  closeTaskModal();
  loadTasks();
}

// ── RESEARCH ──
async function startResearch() {
  const query = document.getElementById('research-query').value.trim();
  if (!query) return;
  setMode('research');
  document.getElementById('research-status').textContent = 'INITIATING…';
  // Send as a chat message for JARVIS to handle
  await sendMessage(`Conduct deep research on: ${query}. Provide a comprehensive synthesis.`);
  document.getElementById('research-status').textContent = 'COMPLETE';
}

// ── DETAILS PANEL ──
async function toggleDetails() {
  const panel = document.getElementById('details-panel');
  detailsVisible = !detailsVisible;
  if (detailsVisible) {
    panel.classList.remove('hidden');
    await loadDetails();
  } else {
    panel.classList.add('hidden');
  }
}

async function loadDetails() {
  const content = document.getElementById('details-content');
  content.innerHTML = 'Loading system data…';
  try {
    const [statsRes, memRes] = await Promise.all([
      fetch(`${API}/api/system/stats`),
      fetch(`${API}/api/memory`)
    ]);
    const stats = await statsRes.json();
    const mem = await memRes.json();

    const rows = [
      ['PLATFORM', stats.os?.platform || 'N/A'],
      ['HOSTNAME', stats.os?.hostname || 'N/A'],
      ['CPU LOAD', `${stats.cpu}%`],
      ['MEMORY', `${stats.memory?.used}% of ${stats.memory?.total}GB`],
      ['DISK', stats.disk?.[0] ? `${stats.disk[0].use}% — ${stats.disk[0].fs}` : 'N/A'],
      ['NET RX', `${stats.network?.rx} KB/s`],
      ['NET TX', `${stats.network?.tx} KB/s`],
      ['CONVERSATIONS', mem.conversations?.length || 0],
      ['KNOWN FACTS', Object.keys(mem.facts || {}).length],
      ['LAST SEEN', mem.lastSeen ? new Date(mem.lastSeen).toLocaleString() : 'N/A'],
      ['STATUS', 'ONLINE']
    ];

    content.innerHTML = rows.map(([k,v]) =>
      `<div class="detail-row"><span class="detail-key">${k}</span><span class="detail-val">${v}</span></div>`
    ).join('');

    if (Object.keys(mem.facts).length > 0) {
      content.innerHTML += `<div style="color:var(--text-dim);font-size:10px;margin-top:10px;letter-spacing:2px;">MEMORY FACTS</div>`;
      Object.entries(mem.facts).forEach(([k,v]) => {
        content.innerHTML += `<div class="detail-row"><span class="detail-key">${k}</span><span class="detail-val">${v.value||v}</span></div>`;
      });
    }
  } catch (e) {
    content.innerHTML = `<span style="color:var(--red)">Failed to load: ${e.message}</span>`;
  }
}

// ── PERMISSION GATE ──
function requestPermission(action, detail) {
  return new Promise((resolve) => {
    permResolve = resolve;
    document.getElementById('perm-body').textContent = `Requested action: ${action}\n\n${detail || ''}`;
    document.getElementById('perm-modal').classList.remove('hidden');
    document.getElementById('perm-approve').onclick = () => {
      document.getElementById('perm-modal').classList.add('hidden');
      resolve(true);
    };
  });
}

function denyPerm() {
  document.getElementById('perm-modal').classList.add('hidden');
  if (permResolve) permResolve(false);
}

// Expose to window for integration
window.JARVIS = {
  setMode,
  sendMessage,
  triggerIntruderAlert,
  requestPermission,
  showAlertBanner
};

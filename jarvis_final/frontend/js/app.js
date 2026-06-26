'use strict';

// ── AUTH CHECK ──
const token = localStorage.getItem('jarvis_token');
if (!token) window.location.href = '/login.html';
const API_HEADERS = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };

// ── STATE ──
let currentMode = 'standby';
let wsConn = null;
let recognition = null;
let isListening = false;
let webcamStream = null;
let detailsVisible = false;
let permResolve = null;
let elevenLabsAvailable = null;

// ── INIT ──
document.addEventListener('DOMContentLoaded', async () => {
  updateClock();
  setInterval(updateClock, 1000);
  connectWS();
  loadTasks();
  setupChat();
  setupWebcam();
  setupVoice();
  setMode('standby');
  checkElevenLabs();

  document.addEventListener('keydown', e => {
    const inp = document.getElementById('chat-input');
    if (e.key === 'Enter' && document.activeElement !== inp) inp.focus();
    if (document.activeElement === inp && e.key === 'Enter') sendMessage();
  });
});

// ── CHECK ELEVENLABS ──
async function checkElevenLabs() {
  try {
    const res = await fetch('/api/ai/tts', {
      method: 'POST',
      headers: API_HEADERS,
      body: JSON.stringify({ text: 'test' })
    });
    elevenLabsAvailable = res.ok;
  } catch { elevenLabsAvailable = false; }
}

// ── CLOCK ──
function updateClock() {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2,'0');
  const mm = String(now.getMinutes()).padStart(2,'0');
  document.getElementById('clock-time').textContent = `${hh}:${mm}`;
  document.getElementById('hdr-time').textContent = `${hh}:${mm}`;
  document.getElementById('clock-date').textContent = now.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',year:'numeric'}).toUpperCase();
}

// ── MODE ──
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

// ── WEBSOCKET ──
function connectWS() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  wsConn = new WebSocket(`${proto}://${location.host}?token=${token}`);
  wsConn.onmessage = (e) => {
    try { const d = JSON.parse(e.data); if (d.type === 'stats') updateStats(d); } catch {}
  };
  wsConn.onclose = () => setTimeout(connectWS, 3000);
}

function updateStats(d) {
  setRing('cpu', d.cpu, `${d.cpu}%`);
  setRing('mem', d.memory, `${d.memory}%`);
  setRing('net', Math.min(d.network, 100), `${d.network}k`);
  setRing('disk', d.disk, `${d.disk}%`);
  Sphere.setEnergy(0.1 + (d.cpu / 100) * 0.5 + (currentMode === 'talking' ? 0.3 : 0));
}

function setRing(id, pct, label) {
  const circ = 2 * Math.PI * 32;
  const offset = circ - (Math.min(pct,100) / 100) * circ;
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
    const res = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: API_HEADERS,
      body: JSON.stringify({ message: text })
    });
    if (res.status === 401) { logout(); return; }
    const data = await res.json();
    if (data.error) throw new Error(data.error);

    document.getElementById('provider-badge').textContent = `AI: ${(data.provider||'gemini').toUpperCase()}`;
    addMessage('jarvis', data.reply);
    showSubtitle(data.reply.slice(0, 140) + (data.reply.length > 140 ? '…' : ''));
    await speakText(data.reply);
  } catch (e) {
    addMessage('jarvis', `Apologies Sir, I encountered an error: ${e.message}`);
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
  sub._t = setTimeout(() => sub.classList.remove('visible'), 7000);
}

// ── TTS — ElevenLabs first, browser fallback ──
async function speakText(text) {
  const clean = text.replace(/\*\*/g,'').replace(/\*/g,'').replace(/#+/g,'').trim();

  if (elevenLabsAvailable) {
    try {
      const res = await fetch('/api/ai/tts', {
        method: 'POST',
        headers: API_HEADERS,
        body: JSON.stringify({ text: clean.slice(0, 400) })
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        Sphere.setEnergy(0.85);
        audio.onended = () => { Sphere.setEnergy(0.3); URL.revokeObjectURL(url); };
        await audio.play();
        return;
      }
    } catch {}
  }

  // Browser TTS fallback
  if (!window.speechSynthesis) return;
  speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(clean.slice(0, 400));
  utter.rate = 0.92; utter.pitch = 0.82; utter.volume = 1;
  const voices = speechSynthesis.getVoices();
  const preferred = voices.find(v => /daniel|george|james|brian/i.test(v.name) && /en/i.test(v.lang))
    || voices.find(v => /en-GB/i.test(v.lang))
    || voices.find(v => /en/i.test(v.lang));
  if (preferred) utter.voice = preferred;
  utter.onstart = () => Sphere.setEnergy(0.8);
  utter.onend = () => Sphere.setEnergy(0.3);
  speechSynthesis.speak(utter);
}
if (window.speechSynthesis) speechSynthesis.onvoiceschanged = () => {};

// ── VOICE INPUT ──
function setupVoice() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { document.getElementById('mic-btn').style.opacity = '0.3'; return; }
  recognition = new SR();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = 'en-US';
  recognition.onresult = (e) => {
    document.getElementById('chat-input').value = e.results[0][0].transcript;
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

// ── BIBLE VERSE ──
async function getBibleVerse() {
  if (currentMode === 'standby') setMode('talking');
  addMessage('user', 'Give me a bible verse for today.');
  showSubtitle('Consulting the scriptures...');
  Sphere.pulse();
  try {
    const res = await fetch('/api/ai/bible', { headers: API_HEADERS });
    if (res.status === 401) { logout(); return; }
    const data = await res.json();
    addMessage('jarvis', data.reply);
    showSubtitle(data.reply.slice(0, 140) + '…');
    await speakText(data.reply);
  } catch (e) {
    addMessage('jarvis', `Unable to retrieve verse, Sir: ${e.message}`);
  }
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
    webcamStream = null; video.srcObject = null; btn.textContent = 'ACTIVATE'; return;
  }
  try {
    webcamStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    video.srcObject = webcamStream; btn.textContent = 'DEACTIVATE';
    startIntruderWatch();
  } catch (e) { console.warn('Webcam:', e.message); }
}
function startIntruderWatch() {
  const video = document.getElementById('webcam');
  const c2 = document.createElement('canvas');
  c2.width = 160; c2.height = 90;
  const ctx = c2.getContext('2d');
  let prev = null, timer = null;
  setInterval(() => {
    if (!webcamStream) return;
    ctx.drawImage(video, 0, 0, 160, 90);
    const frame = ctx.getImageData(0, 0, 160, 90).data;
    if (prev) {
      let diff = 0;
      for (let i = 0; i < frame.length; i += 4) diff += Math.abs(frame[i] - prev[i]);
      if (diff / (160*90) > 25) {
        if (!timer) timer = setTimeout(() => { triggerIntruderAlert(); timer = null; }, 4000);
      } else { clearTimeout(timer); timer = null; }
    }
    prev = new Uint8ClampedArray(frame);
  }, 500);
}
function triggerIntruderAlert() {
  setMode('alert');
  showAlertBanner('⚠ INTRUDER DETECTED — LOCKING INTERFACE — AWAITING BIOMETRIC CONFIRMATION');
  speakText('Sir, I have detected an unrecognized presence at the workstation. Initiating lockdown protocol now.');
  fetch('/api/automation/alert', { method:'POST', headers: API_HEADERS, body: JSON.stringify({ type:'intruder', message:'Motion anomaly detected at workstation', severity:'critical' }) }).catch(()=>{});
}

// ── ALERTS ──
function showAlertBanner(msg) {
  document.getElementById('alert-text').textContent = msg;
  document.getElementById('alert-banner').classList.remove('hidden');
}
function dismissAlert() {
  document.getElementById('alert-banner').classList.add('hidden');
  if (currentMode === 'alert') setMode('standby');
}

// ── TASKS ──
async function loadTasks() {
  try {
    const res = await fetch('/api/automation/tasks', { headers: API_HEADERS });
    if (res.status === 401) { logout(); return; }
    renderTasks(await res.json());
  } catch {}
}
function renderTasks(tasks) {
  const list = document.getElementById('task-list');
  list.innerHTML = tasks.length ? '' : '<div style="color:rgba(200,232,240,0.3);font-size:10px;padding:8px;text-align:center">NO TASKS</div>';
  tasks.forEach(t => {
    const div = document.createElement('div');
    div.className = `task-item task-${t.priority}`;
    div.innerHTML = `<div class="task-title">${t.title}</div><div class="task-status">${t.status.toUpperCase()} · ${t.priority.toUpperCase()}</div>`;
    div.onclick = () => cycleTaskStatus(t.id, t.status);
    list.appendChild(div);
  });
}
async function cycleTaskStatus(id, current) {
  const next = { pending:'active', active:'done', done:'pending' };
  await fetch(`/api/automation/tasks/${id}`, { method:'PATCH', headers: API_HEADERS, body: JSON.stringify({ status: next[current]||'active' }) });
  loadTasks();
}
function showAddTask() { document.getElementById('task-modal').classList.remove('hidden'); }
function closeTaskModal() { document.getElementById('task-modal').classList.add('hidden'); }
async function submitTask() {
  const title = document.getElementById('task-title-inp').value.trim();
  if (!title) return;
  await fetch('/api/automation/tasks', { method:'POST', headers: API_HEADERS, body: JSON.stringify({ title, description: document.getElementById('task-desc-inp').value, priority: document.getElementById('task-pri-inp').value }) });
  closeTaskModal(); loadTasks();
}

// ── RESEARCH ──
async function startResearch() {
  const query = document.getElementById('research-query').value.trim();
  if (!query) return;
  setMode('research');
  document.getElementById('research-status').textContent = 'INITIATING…';
  await sendMessage(`Conduct deep research on: ${query}. Provide a comprehensive synthesis with key findings, constraints, and recommendations.`);
  document.getElementById('research-status').textContent = 'COMPLETE';
  setMode('talking');
}

// ── DETAILS PANEL ──
async function toggleDetails() {
  const panel = document.getElementById('details-panel');
  detailsVisible = !detailsVisible;
  if (detailsVisible) { panel.classList.remove('hidden'); await loadDetails(); }
  else panel.classList.add('hidden');
}
async function loadDetails() {
  const content = document.getElementById('details-content');
  content.innerHTML = 'Loading…';
  try {
    const [sRes, mRes] = await Promise.all([
      fetch('/api/system/stats', { headers: API_HEADERS }),
      fetch('/api/memory', { headers: API_HEADERS })
    ]);
    const stats = await sRes.json();
    const mem = await mRes.json();
    const rows = [
      ['PLATFORM', stats.os?.platform||'N/A'],
      ['HOSTNAME', stats.os?.hostname||'N/A'],
      ['CPU', `${stats.cpu}%`],
      ['MEMORY', `${stats.memory?.used}% of ${stats.memory?.total}GB`],
      ['DISK', stats.disk?.[0] ? `${stats.disk[0].use}%` : 'N/A'],
      ['NET RX', `${stats.network?.rx} KB/s`],
      ['ELEVENLABS', elevenLabsAvailable ? '✅ ACTIVE' : '⚠ BROWSER TTS'],
      ['CONVERSATIONS', mem.conversations?.length||0],
      ['FACTS STORED', Object.keys(mem.facts||{}).length],
      ['LAST SEEN', mem.lastSeen ? new Date(mem.lastSeen).toLocaleString() : 'N/A'],
      ['VERSION', '0.0.1'],
      ['STATUS', 'ONLINE']
    ];
    content.innerHTML = rows.map(([k,v]) =>
      `<div class="detail-row"><span class="detail-key">${k}</span><span class="detail-val">${v}</span></div>`
    ).join('');
    if (Object.keys(mem.facts||{}).length > 0) {
      content.innerHTML += `<div style="color:var(--text-dim);font-size:10px;margin-top:10px;letter-spacing:2px;padding-top:8px;border-top:1px solid var(--border)">MEMORY FACTS</div>`;
      Object.entries(mem.facts).forEach(([k,v]) => {
        content.innerHTML += `<div class="detail-row"><span class="detail-key">${k}</span><span class="detail-val">${v.value||v}</span></div>`;
      });
    }
  } catch(e) { content.innerHTML = `<span style="color:var(--red)">Error: ${e.message}</span>`; }
}

// ── PERMISSION ──
function requestPermission(action, detail) {
  return new Promise((resolve) => {
    permResolve = resolve;
    document.getElementById('perm-body').textContent = `Action: ${action}\n\n${detail||''}`;
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

// ── LOGOUT ──
function logout() {
  localStorage.removeItem('jarvis_token');
  window.location.href = '/login.html';
}

window.JARVIS = { setMode, sendMessage, getBibleVerse, triggerIntruderAlert, requestPermission, logout };

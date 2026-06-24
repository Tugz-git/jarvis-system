# J.A.R.V.I.S. — Neural Operating System v0.0.1

> "Just A Rather Very Intelligent System"
> Built for the desk. Ready for the field.

---

## QUICK START

```bash
# 1. Install dependencies
npm install

# 2. Configure API keys
cp .env .env.backup
nano .env   # or open in any editor

# 3. Run the system
npm start

# 4. Open your browser
# http://localhost:3000
```

---

## CONFIGURATION — `.env`

```env
GEMINI_API_KEY=AIza...          # Primary AI — get at aistudio.google.com
MISTRAL_API_KEY=...             # Fallback AI — get at console.mistral.ai
ELEVENLABS_API_KEY=...          # (Optional) Premium TTS
WEATHER_API_KEY=...             # (Optional) OpenWeatherMap
PORT=3000
```

**AI Priority:** Gemini runs first. If it fails (rate limit, outage), Mistral activates automatically.

---

## THE DOCTOR COMMAND

```bash
# Diagnose all issues
node backend/doctor.js

# Auto-fix what can be fixed
node backend/doctor.js --fix

# Or via npm shortcut
npm run doctor
npm run fix
```

The doctor checks:
- `.env` file presence and key validity
- All required directories and files
- `node_modules` installation
- Memory file integrity
- API key format

---

## FEATURES

### 🌐 Interface
- **Standby Clock** — full-screen time display when idle, vanishes when talking
- **Animated Particle Sphere** — 1,800-particle dynamic sphere; color and energy respond to CPU load, voice activity, and mode
- **HUD Rings** — live CPU, Memory, Network, Disk metrics via WebSocket
- **Subtitle Bar** — last JARVIS response shown as subtitles without opening chat
- **Scan Lines** — CRT-style overlay for that authentic HUD feel

### 🤖 AI System
- **Gemini 1.5 Flash** — primary (fast, capable)
- **Mistral Small** — emergency fallback (auto-switches silently)
- **Persistent Memory** — all conversations + facts stored in `backend/memory/jarvis_memory.json`
  - Remembers across sessions (OpenClaw-style local memory)
  - Up to 200 conversation turns kept
  - Custom facts can be stored: `POST /api/memory/fact { key, value }`

### 🎙 Voice
- **Web Speech API** — click the mic button or press the mic icon
- **Text-to-Speech** — auto-reads JARVIS replies; prefers deep British-sounding voices
- **Voice Input** — speaks naturally, transcribed and sent to JARVIS

### 📷 Webcam + Intruder Detection
- Click **ACTIVATE** in the Visual Feed panel
- Runs motion detection every 500ms
- If significant motion is detected for 4+ seconds → triggers RED ALERT
- Logs alert to database, switches sphere to red mode
- Prompts "AWAITING BIOMETRIC CONFIRMATION"

### 📋 Tasks
- Add/view tasks in the right panel
- Click a task to cycle its status: pending → active → done
- Persisted in local SQLite database

### 🔬 Deep Research
- Type a topic in the Research panel → JARVIS conducts a comprehensive synthesis via AI
- Status updates shown in panel

### 🔒 Permission Gate
- All file writes, deletes, and system automation require explicit approval
- A modal appears asking you to APPROVE or DENY before any action executes

---

## API ENDPOINTS

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/ai/chat` | Send message to JARVIS |
| GET | `/api/system/stats` | Live system metrics |
| GET | `/api/memory` | Full memory dump |
| POST | `/api/memory/fact` | Store a persistent fact |
| GET | `/api/automation/tasks` | List tasks |
| POST | `/api/automation/tasks` | Create task |
| PATCH | `/api/automation/tasks/:id` | Update task status |
| POST | `/api/automation/run` | Run safe system command (needs `approved: true`) |
| POST | `/api/files/write` | Write file (needs `approved: true`) |
| DELETE | `/api/files/delete` | Delete file (needs `approved: true`) |
| GET | `/api/status` | Health check |

---

## PROJECT STRUCTURE

```
jarvis/
├── .env                        # API keys (never commit this)
├── package.json
├── backend/
│   ├── server.js               # Express + WebSocket server
│   ├── doctor.js               # Self-healing diagnostics
│   ├── db/
│   │   └── database.js         # SQLite schema + connection
│   ├── memory/
│   │   ├── memory.js           # Persistent memory engine
│   │   └── jarvis_memory.json  # Auto-created on first run
│   └── routes/
│       ├── ai.js               # Gemini/Mistral + memory
│       ├── system.js           # System metrics
│       ├── memory.js           # Memory CRUD
│       ├── files.js            # File operations (gated)
│       └── automation.js       # Tasks, alerts, safe commands
└── frontend/
    ├── index.html              # Main JARVIS UI
    ├── css/
    │   └── jarvis.css          # Full HUD stylesheet
    └── js/
        ├── sphere.js           # Particle sphere renderer
        └── app.js              # Application logic
```

---

## SPHERE MODES

| Mode | Color | Trigger |
|------|-------|---------|
| Standby | Cyan-blue | Idle, clock visible |
| Talking | Bright cyan | Active conversation |
| Alert | Red | Intruder detected |
| Research | Purple | Deep research active |
| Gold | Gold | (Future: mission complete) |

---

## KNOWN LIMITATIONS & NOTES

- **Voice quality**: Uses browser's built-in Web Speech API. For Iron Man-quality Jarvis voice, add an ElevenLabs key (integration ready in the backend — frontend TTS can be extended to call it).
- **Webcam intruder detection**: Uses pixel-diff motion detection. Not facial recognition — any motion triggers it after 4 seconds.
- **Safe commands**: Only whitelisted commands can run via automation (open, volume, notifications). Destructive commands are blocked.
- **Memory**: Local only — no cloud sync. Stored in `backend/memory/jarvis_memory.json`.
- **Mobile**: The UI is desktop-optimized. Mobile companion requires a separate PWA build.

---

## TROUBLESHOOTING

```bash
# Something broken?
node backend/doctor.js --fix

# Server won't start?
npm install
node backend/server.js

# AI not responding?
# 1. Check .env has valid keys
# 2. Check Gemini/Mistral quotas at their dashboards

# Voice not working?
# Use Chrome or Edge — Firefox has limited Web Speech support

# Webcam not activating?
# Ensure browser has camera permissions (click the lock icon in address bar)
```

---

*"Online and at your service, Sir."*

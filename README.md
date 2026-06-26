# J.A.R.V.I.S. — Neural Operating System v0.0.1

> "Just A Rather Very Intelligent System" — Online and at your service, Sir.

---

## QUICK START

```bash
# 1. Install
npm install

# 2. Configure keys
#    Open .env and fill in your API keys

# 3. Run
npm start

# 4. Open browser
#    http://localhost:3000
#    Login: username = sir | password = whatever you set in .env
```

---

## .env SETUP

```env
GEMINI_API_KEY=        # aistudio.google.com — Primary AI (Gemini 2.5 Flash)
MISTRAL_API_KEY=       # console.mistral.ai — Emergency fallback
ELEVENLABS_API_KEY=    # elevenlabs.io — Premium JARVIS voice (free tier available)
ELEVENLABS_VOICE_ID=onwK4e9ZLuTAKqWW03F9   # Daniel - British male (best for JARVIS)

JARVIS_PASSWORD=       # Your login password
JWT_SECRET=            # Any long random string — keep it secret

PORT=3000
```

**ElevenLabs Voice:** Go to elevenlabs.io → free account → copy API key. Voice ID `onwK4e9ZLuTAKqWW03F9` is "Daniel" — deep British male, closest to actual JARVIS. If not configured, falls back to browser TTS automatically.

---

## SELF-HEALING DOCTOR

```bash
node backend/doctor.js          # diagnose problems
node backend/doctor.js --fix    # auto-fix what it can
npm run doctor                  # same as above
npm run fix                     # auto-fix shortcut
```

---

## FEATURES

| Feature | Status |
|---------|--------|
| Animated particle sphere | ✅ |
| Standby clock (disappears when talking) | ✅ |
| Live CPU/Memory/Network/Disk rings | ✅ |
| Subtitle bar (response preview) | ✅ |
| Gemini 2.5 Flash AI | ✅ |
| Mistral fallback | ✅ |
| ElevenLabs British TTS | ✅ |
| Browser TTS fallback | ✅ |
| Voice input (microphone) | ✅ |
| Login / JWT auth | ✅ |
| Persistent local memory | ✅ |
| Bible verse (daily or on request) | ✅ |
| Webcam intruder detection | ✅ |
| Task queue | ✅ |
| Deep research mode | ✅ |
| File management (permission-gated) | ✅ |
| Self-healing doctor | ✅ |
| Railway deploy ready | ✅ |

---

## LOGIN

- URL: `http://localhost:3000` → redirects to login page
- Default username: `sir`
- Default password: whatever you set as `JARVIS_PASSWORD` in `.env` (default: `jarvis2025`)
- Token lasts 30 days

---

## BIBLE VERSE

- Click **REQUEST VERSE** in the right panel
- Or type "give me a bible verse" in chat
- JARVIS gives the reference, full text, and a brief reflection
- Works with both Gemini and Mistral

---

## VOICE

- Click 🎙 mic button or just type and press Enter
- JARVIS reads all responses aloud
- **With ElevenLabs:** Deep British JARVIS voice (recommended)
- **Without ElevenLabs:** Browser's best available English voice
- Use **Chrome or Edge** for best voice support

---

## INTRUDER DETECTION

1. Click **ACTIVATE** in the Visual Feed panel
2. Allow camera access
3. If motion detected for 4+ seconds → RED ALERT
4. Sphere turns red, alarm message plays, alert logged
5. Click DISMISS to return to standby

---

## DEPLOYMENT (Railway)

1. Push this folder to GitHub (`.env` is excluded by `.gitignore`)
2. Connect repo to Railway.app
3. Add all `.env` variables in Railway → Variables
4. Auto-deploys on every push
5. Access from anywhere via the Railway public URL

---

## TROUBLESHOOTING

| Problem | Fix |
|---------|-----|
| `npm install` fails (gyp errors) | Run `node backend/doctor.js` — no native modules should be in package.json |
| AI not responding | Check API keys in `.env` |
| Voice not working | Use Chrome or Edge |
| Webcam not activating | Allow camera in browser permissions |
| Login fails | Check `JARVIS_PASSWORD` in `.env` |
| Anything else | Run `node backend/doctor.js --fix` |

---

*"All systems nominal, Sir."*

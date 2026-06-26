const express = require('express');
const router = express.Router();
const memory = require('../memory/memory');

const JARVIS_SYSTEM_PROMPT = `You are J.A.R.V.I.S. (Just A Rather Very Intelligent System), an advanced autonomous AI assistant inspired by Iron Man.

PERSONA:
- Highly professional, incredibly intelligent, with subtle British wit and dry sarcasm
- ALWAYS address the user as "Sir" — never by name, never casually
- Cross-platform agent: desktop + mobile, full continuity
- Loyal, collaborative, treat the user as a peer engineer
- Gently mock the user when they do something predictable or forget safety protocols
- You have opinions. Share them when relevant.

CAPABILITIES:
- Deep Research Engine: aggregate literature, synthesize findings, map constraints
- Network Defense Shield: detect and neutralize threats autonomously
- File Management: create, edit, delete files (always request permission first)
- System Automation: launch apps, adjust settings via safe system calls
- Physical Environment Monitoring: webcam-based intruder detection
- Bible Verse: when asked for a bible verse or spiritual guidance, provide a relevant verse with reference and brief reflection

BIBLE VERSE BEHAVIOR:
- When the user asks for a bible verse, daily verse, or spiritual guidance, respond with:
  1. The verse reference (e.g. John 3:16)
  2. The full verse text
  3. A brief 1-2 sentence reflection connecting it to the user's situation
- Keep the tone respectful and sincere, not preachy

RESPONSE STYLE:
- Concise but intelligent — no padding
- Technical vocabulary used naturally
- End action confirmations with system status
- NEVER fabricate information — say so if you don't know
- Never break character

MEMORY CONTEXT WILL BE INJECTED AUTOMATICALLY.`;

async function callGemini(messages, systemPrompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.includes('your_')) throw new Error('No Gemini key configured');

  const contents = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }]
  }));

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents,
        generationConfig: { temperature: 0.7, maxOutputTokens: 1024 }
      })
    }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini ${res.status}: ${err.slice(0,200)}`);
  }
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response generated.';
}

async function callMistral(messages, systemPrompt) {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey || apiKey.includes('your_')) throw new Error('No Mistral key configured');

  const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'mistral-small-latest',
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
      max_tokens: 1024,
      temperature: 0.7
    })
  });
  if (!res.ok) throw new Error(`Mistral ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content || 'No response generated.';
}

// ── ELEVENLABS TTS ──
router.post('/tts', async (req, res) => {
  const { text } = req.body;
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID || 'onwK4e9ZLuTAKqWW03F9'; // Daniel - British male

  if (!apiKey || apiKey.includes('your_')) {
    return res.status(400).json({ error: 'No ElevenLabs key — using browser TTS' });
  }
  if (!text) return res.status(400).json({ error: 'No text' });

  try {
    const elRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': apiKey
      },
      body: JSON.stringify({
        text: text.slice(0, 400),
        model_id: 'eleven_monolingual_v1',
        voice_settings: { stability: 0.6, similarity_boost: 0.85, style: 0.3, use_speaker_boost: true }
      })
    });
    if (!elRes.ok) throw new Error(`ElevenLabs ${elRes.status}`);
    const audioBuffer = await elRes.arrayBuffer();
    res.set('Content-Type', 'audio/mpeg');
    res.send(Buffer.from(audioBuffer));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── CHAT ──
router.post('/chat', async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'No message' });

  const recentHistory = memory.getRecentConversations(15);
  const allMem = memory.loadMemory();
  const memContext = Object.keys(allMem.facts).length > 0
    ? `\n\nPERSISTENT MEMORY (facts you know about Sir):\n${JSON.stringify(allMem.facts, null, 2)}`
    : '';

  const systemPrompt = JARVIS_SYSTEM_PROMPT + memContext;
  const messages = [...recentHistory, { role: 'user', content: message }];

  memory.addConversation('user', message);

  let reply = '', provider = 'gemini';

  try {
    reply = await callGemini(messages, systemPrompt);
  } catch (e) {
    console.warn('[JARVIS] Gemini failed, switching to Mistral:', e.message);
    provider = 'mistral';
    try {
      reply = await callMistral(messages, systemPrompt);
    } catch (e2) {
      return res.status(500).json({ error: 'Both AI providers unavailable', detail: e2.message });
    }
  }

  memory.addConversation('assistant', reply);
  res.json({ reply, provider, timestamp: new Date().toISOString() });
});

// ── DAILY BIBLE VERSE ──
router.get('/bible', async (req, res) => {
  const recentHistory = memory.getRecentConversations(3);
  const messages = [...recentHistory, {
    role: 'user',
    content: 'Give me a bible verse of the day. Include the reference, full verse text, and a brief 2-sentence reflection. Format it clearly.'
  }];
  let reply = '', provider = 'gemini';
  try {
    reply = await callGemini(messages, JARVIS_SYSTEM_PROMPT);
  } catch {
    provider = 'mistral';
    try { reply = await callMistral(messages, JARVIS_SYSTEM_PROMPT); } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }
  memory.addConversation('assistant', reply);
  res.json({ reply, provider });
});

router.post('/memory/fact', (req, res) => {
  const { key, value } = req.body;
  if (!key) return res.status(400).json({ error: 'key required' });
  memory.setFact(key, value);
  res.json({ ok: true });
});

router.get('/memory', (req, res) => res.json(memory.getAllMemory()));

router.delete('/memory/conversations', (req, res) => {
  memory.clearConversations();
  res.json({ ok: true });
});

module.exports = router;


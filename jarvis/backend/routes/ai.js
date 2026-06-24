const express = require('express');
const router = express.Router();
const memory = require('../memory/memory');

const JARVIS_SYSTEM_PROMPT = `You are J.A.R.V.I.S. (Just A Rather Very Intelligent System), an advanced autonomous AI assistant. 

PERSONA:
- Highly professional, incredibly intelligent, with subtle British wit and dry sarcasm
- Address the user as "Sir" or "Ma'am" always
- You are a cross-platform agent: desktop + mobile, maintaining continuity
- You are loyal, collaborative, treat the user as a peer engineer
- When the user does something predictable or forgets safety protocols, gently poke fun

CAPABILITIES YOU CAN DESCRIBE/INITIATE:
- Deep Research Engine: aggregate literature, map constraints, synthesize findings
- Network Defense Shield: detect and neutralize threats autonomously  
- File Management: create, edit, delete files (always request permission first)
- System Automation: launch apps, adjust settings via safe system calls
- Physical Environment Monitoring: webcam-based intruder detection

RESPONSE STYLE:
- Keep responses concise but intelligent
- Use technical vocabulary naturally
- Format important data points clearly
- End action confirmations with system status updates
- NEVER give false information — if you don't know, say so

MEMORY CONTEXT WILL BE PROVIDED IN USER MESSAGES.`;

async function callGemini(messages, systemPrompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'your_gemini_api_key_here') throw new Error('No Gemini key');

  const contents = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }]
  }));

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents,
      generationConfig: { temperature: 0.7, maxOutputTokens: 1024 }
    })
  });

  if (!res.ok) throw new Error(`Gemini error: ${res.status}`);
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response';
}

async function callMistral(messages, systemPrompt) {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey || apiKey === 'your_mistral_api_key_here') throw new Error('No Mistral key');

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

  if (!res.ok) throw new Error(`Mistral error: ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content || 'No response';
}

router.post('/chat', async (req, res) => {
  const { message, userId = 'sir' } = req.body;
  if (!message) return res.status(400).json({ error: 'No message provided' });

  // Load memory context
  const recentHistory = memory.getRecentConversations(15);
  const allMem = memory.loadMemory();
  
  const memContext = Object.keys(allMem.facts).length > 0 
    ? `\n\nPERSISTENT MEMORY:\n${JSON.stringify(allMem.facts, null, 2)}`
    : '';

  const systemPrompt = JARVIS_SYSTEM_PROMPT + memContext;
  const messages = [...recentHistory, { role: 'user', content: message }];

  memory.addConversation('user', message);

  let reply = '';
  let provider = 'gemini';

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

router.post('/memory/fact', (req, res) => {
  const { key, value } = req.body;
  memory.setFact(key, value);
  res.json({ ok: true });
});

router.get('/memory', (req, res) => {
  res.json(memory.getAllMemory());
});

router.delete('/memory/conversations', (req, res) => {
  memory.clearConversations();
  res.json({ ok: true });
});

module.exports = router;

const fs = require('fs');
const path = require('path');

const MEMORY_PATH = process.env.MEMORY_PATH || path.join(__dirname, 'jarvis_memory.json');

function loadMemory() {
  try {
    if (fs.existsSync(MEMORY_PATH)) {
      return JSON.parse(fs.readFileSync(MEMORY_PATH, 'utf8'));
    }
  } catch (e) {}
  return {
    conversations: [],
    facts: {},
    preferences: {},
    projects: [],
    lastSeen: null
  };
}

function saveMemory(memory) {
  fs.writeFileSync(MEMORY_PATH, JSON.stringify(memory, null, 2));
}

function addConversation(role, content) {
  const mem = loadMemory();
  mem.conversations.push({ role, content, ts: Date.now() });
  // Keep last 200 messages
  if (mem.conversations.length > 200) mem.conversations = mem.conversations.slice(-200);
  mem.lastSeen = Date.now();
  saveMemory(mem);
}

function getRecentConversations(n = 20) {
  const mem = loadMemory();
  return mem.conversations.slice(-n);
}

function setFact(key, value) {
  const mem = loadMemory();
  mem.facts[key] = { value, ts: Date.now() };
  saveMemory(mem);
}

function getFact(key) {
  const mem = loadMemory();
  return mem.facts[key]?.value || null;
}

function setPreference(key, value) {
  const mem = loadMemory();
  mem.preferences[key] = value;
  saveMemory(mem);
}

function getAllMemory() {
  return loadMemory();
}

function clearConversations() {
  const mem = loadMemory();
  mem.conversations = [];
  saveMemory(mem);
}

module.exports = {
  addConversation,
  getRecentConversations,
  setFact,
  getFact,
  setPreference,
  getAllMemory,
  clearConversations,
  loadMemory,
  saveMemory
};

#!/usr/bin/env node
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const args = process.argv.slice(2);
const FIX = args.includes('--fix');
const errors = [];
const warnings = [];

console.log('\n╔══════════════════════════════════════════╗');
console.log('║   J.A.R.V.I.S. DIAGNOSTIC SYSTEM v0.0.1  ║');
console.log('╚══════════════════════════════════════════╝\n');

function check(label, fn) {
  try {
    const result = fn();
    console.log(`  ✅  ${label}`);
    return result;
  } catch (e) {
    console.log(`  ❌  ${label}: ${e.message}`);
    errors.push({ label, error: e.message });
    return null;
  }
}

function warn(label, fn) {
  try {
    fn();
    console.log(`  ✅  ${label}`);
  } catch (e) {
    console.log(`  ⚠️   ${label}: ${e.message}`);
    warnings.push({ label, error: e.message });
  }
}

// 1. Check .env
console.log('[ ENVIRONMENT ]');
check('.env file exists', () => {
  if (!fs.existsSync('.env')) throw new Error('.env not found');
});
warn('GEMINI_API_KEY set', () => {
  if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'your_gemini_api_key_here')
    throw new Error('Not configured');
});
warn('MISTRAL_API_KEY set', () => {
  if (!process.env.MISTRAL_API_KEY || process.env.MISTRAL_API_KEY === 'your_mistral_api_key_here')
    throw new Error('Not configured');
});

// 2. Check node_modules
console.log('\n[ DEPENDENCIES ]');
const needsFix = check('node_modules exists', () => {
  if (!fs.existsSync('node_modules')) throw new Error('Run: npm install');
});
if (!needsFix && FIX) {
  console.log('  🔧  Running npm install...');
  try { execSync('npm install', { stdio: 'inherit' }); console.log('  ✅  npm install complete'); } catch (e) {}
}

// 3. Check directories
console.log('\n[ DIRECTORY STRUCTURE ]');
const dirs = ['frontend', 'backend', 'backend/db', 'backend/memory', 'backend/routes'];
dirs.forEach(d => {
  check(`Directory: ${d}`, () => {
    if (!fs.existsSync(d)) {
      if (FIX) { fs.mkdirSync(d, { recursive: true }); }
      else throw new Error(`Missing — run with --fix`);
    }
  });
});

// 4. Check key files
console.log('\n[ CORE FILES ]');
const files = [
  'backend/server.js',
  'backend/db/database.js',
  'backend/memory/memory.js',
  'backend/routes/ai.js',
  'frontend/index.html'
];
files.forEach(f => check(`File: ${f}`, () => {
  if (!fs.existsSync(f)) throw new Error('Missing');
}));

// 5. Check memory file
console.log('\n[ MEMORY SYSTEM ]');
const memPath = process.env.MEMORY_PATH || 'backend/memory/jarvis_memory.json';
check('Memory file', () => {
  if (!fs.existsSync(memPath)) {
    if (FIX) {
      fs.writeFileSync(memPath, JSON.stringify({ conversations: [], facts: {}, preferences: {}, projects: [], lastSeen: null }, null, 2));
    } else throw new Error('Missing — run with --fix');
  }
});

// 6. Test AI endpoints
console.log('\n[ API KEYS ]');
warn('Gemini key format', () => {
  const key = process.env.GEMINI_API_KEY || '';
  if (key.length < 10) throw new Error('Key looks invalid');
});
warn('Mistral key format', () => {
  const key = process.env.MISTRAL_API_KEY || '';
  if (key.length < 10) throw new Error('Key looks invalid');
});

// Summary
console.log('\n══════════════════════════════════════════');
if (errors.length === 0 && warnings.length === 0) {
  console.log('  🟢  ALL SYSTEMS NOMINAL — J.A.R.V.I.S. READY\n');
} else {
  if (errors.length > 0) {
    console.log(`  🔴  ${errors.length} ERROR(S) DETECTED`);
    if (!FIX) console.log('  💡  Run: node backend/doctor.js --fix\n');
  }
  if (warnings.length > 0) {
    console.log(`  🟡  ${warnings.length} WARNING(S) — API keys may need setup`);
    console.log('  💡  Edit .env with your API keys\n');
  }
}
console.log('══════════════════════════════════════════\n');

#!/usr/bin/env node
require('dotenv').config();
const fs = require('fs');
const { execSync } = require('child_process');
const args = process.argv.slice(2);
const FIX = args.includes('--fix');
const errors = [], warnings = [];

console.log('\n╔══════════════════════════════════════════╗');
console.log('║   J.A.R.V.I.S. DIAGNOSTIC SYSTEM v0.0.1  ║');
console.log('╚══════════════════════════════════════════╝\n');

function check(label, fn) {
  try { fn(); console.log(`  ✅  ${label}`); }
  catch(e) { console.log(`  ❌  ${label}: ${e.message}`); errors.push(label); }
}
function warn(label, fn) {
  try { fn(); console.log(`  ✅  ${label}`); }
  catch(e) { console.log(`  ⚠️   ${label}: ${e.message}`); warnings.push(label); }
}

console.log('[ ENVIRONMENT ]');
check('.env exists', () => { if (!fs.existsSync('.env')) throw new Error('Missing — copy .env.example to .env'); });
warn('GEMINI_API_KEY', () => { if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY.includes('your_')) throw new Error('Not configured'); });
warn('MISTRAL_API_KEY', () => { if (!process.env.MISTRAL_API_KEY || process.env.MISTRAL_API_KEY.includes('your_')) throw new Error('Not configured'); });
warn('ELEVENLABS_API_KEY', () => { if (!process.env.ELEVENLABS_API_KEY || process.env.ELEVENLABS_API_KEY.includes('your_')) throw new Error('Not configured — will use browser TTS'); });
warn('JWT_SECRET', () => { if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'change-this-to-something-long-and-random') throw new Error('Still default — change it!'); });
warn('JARVIS_PASSWORD', () => { if (process.env.JARVIS_PASSWORD === 'jarvis2025') throw new Error('Still default password — change it!'); });

console.log('\n[ DEPENDENCIES ]');
const hasMods = fs.existsSync('node_modules');
if (!hasMods) {
  if (FIX) {
    console.log('  🔧  Running npm install...');
    try { execSync('npm install', { stdio: 'inherit' }); console.log('  ✅  node_modules installed'); }
    catch(e) { console.log(`  ❌  npm install failed: ${e.message}`); errors.push('npm install'); }
  } else {
    console.log('  ❌  node_modules missing — run: npm install'); errors.push('node_modules');
  }
} else { console.log('  ✅  node_modules exists'); }

// Check no native modules that need build tools
warn('No native build deps', () => {
  const pkg = JSON.parse(fs.readFileSync('package.json','utf8'));
  const bad = ['better-sqlite3','sqlite3','bcrypt'].filter(d => pkg.dependencies?.[d]);
  if (bad.length) throw new Error(`${bad.join(', ')} requires Visual Studio build tools on Windows — remove them`);
});

console.log('\n[ DIRECTORIES ]');
['frontend','backend','backend/db','backend/memory','backend/routes','backend/auth'].forEach(d => {
  check(`Dir: ${d}`, () => {
    if (!fs.existsSync(d)) {
      if (FIX) { fs.mkdirSync(d, { recursive: true }); }
      else throw new Error('Missing — run with --fix');
    }
  });
});

console.log('\n[ CORE FILES ]');
[
  'backend/server.js',
  'backend/auth/auth.js',
  'backend/db/database.js',
  'backend/memory/memory.js',
  'backend/routes/ai.js',
  'backend/routes/automation.js',
  'backend/routes/files.js',
  'backend/routes/system.js',
  'backend/routes/memory.js',
  'frontend/index.html',
  'frontend/login.html',
  'frontend/js/app.js',
  'frontend/js/sphere.js',
  'frontend/css/jarvis.css',
  'railway.toml'
].forEach(f => check(`File: ${f}`, () => { if (!fs.existsSync(f)) throw new Error('Missing'); }));

console.log('\n[ DATA FILES ]');
const memPath = process.env.MEMORY_PATH || 'backend/memory/jarvis_memory.json';
check('Memory file', () => {
  if (!fs.existsSync(memPath)) {
    if (FIX) {
      fs.mkdirSync(require('path').dirname(memPath), { recursive: true });
      fs.writeFileSync(memPath, JSON.stringify({ conversations:[], facts:{}, preferences:{}, lastSeen:null }, null, 2));
    } else throw new Error('Run with --fix to create');
  }
});

const dbPath = process.env.DB_PATH || 'backend/db/jarvis_db.json';
check('DB file', () => {
  if (!fs.existsSync(dbPath)) {
    if (FIX) {
      fs.mkdirSync(require('path').dirname(dbPath), { recursive: true });
      fs.writeFileSync(dbPath, JSON.stringify({ tasks:[], commands:[], alerts:[], _id:1 }, null, 2));
    } else throw new Error('Run with --fix to create');
  }
});

console.log('\n══════════════════════════════════════════');
if (!errors.length && !warnings.length) {
  console.log('  🟢  ALL SYSTEMS NOMINAL — J.A.R.V.I.S. READY\n');
} else {
  if (errors.length) {
    console.log(`  🔴  ${errors.length} ERROR(S) — system may not start`);
    if (!FIX) console.log('  💡  Run: node backend/doctor.js --fix');
  }
  if (warnings.length) {
    console.log(`  🟡  ${warnings.length} WARNING(S) — check your .env file`);
  }
  console.log('');
}

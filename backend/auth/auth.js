const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const SECRET = process.env.JWT_SECRET || 'jarvis-secret-change-me';
const USERS_FILE = path.join(__dirname, '../db/users.json');

function loadUsers() {
  if (!fs.existsSync(USERS_FILE)) return [];
  return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
}

function saveUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

function ensureDefaultUser() {
  const users = loadUsers();
  if (users.length === 0) {
    const pass = process.env.JARVIS_PASSWORD || 'jarvis2025';
    const hash = bcrypt.hashSync(pass, 10);
    users.push({ id: 1, username: 'sir', password: hash });
    saveUsers(users);
    console.log(`[JARVIS] Default user created. Password: ${pass}`);
  }
}

function authMiddleware(req, res, next) {
  // Allow login endpoint
  if (req.path === '/api/auth/login') return next();
  
  const token = req.headers['authorization']?.replace('Bearer ', '') 
    || req.cookies?.jarvis_token;
  
  if (!token) return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required, Sir.' });
  
  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'INVALID_TOKEN', message: 'Token expired or invalid.' });
  }
}

function login(username, password) {
  const users = loadUsers();
  const user = users.find(u => u.username === username);
  if (!user) return null;
  if (!bcrypt.compareSync(password, user.password)) return null;
  return jwt.sign({ id: user.id, username }, SECRET, { expiresIn: '30d' });
}

module.exports = { authMiddleware, login, ensureDefaultUser };

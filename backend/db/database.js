const fs = require('fs');
const path = require('path');

const dbPath = process.env.DB_PATH || path.join(__dirname, 'jarvis_db.json');

function loadDb() {
  if (!fs.existsSync(dbPath)) {
    const init = { tasks: [], commands: [], preferences: [], alerts: [], research_sessions: [], _id: 1 };
    fs.writeFileSync(dbPath, JSON.stringify(init, null, 2));
    return init;
  }
  return JSON.parse(fs.readFileSync(dbPath, 'utf8'));
}

function saveDb(data) {
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

function getDb() {
  return {
    prepare: (sql) => {
      return {
        run: (...args) => {
          const db = loadDb();
          const now = new Date().toISOString();

          if (sql.includes('INSERT INTO tasks')) {
            const [title, description, priority] = args;
            const id = db._id++;
            db.tasks.push({ id, title, description, priority, status: 'pending', created_at: now, updated_at: now });
            saveDb(db);
            return { lastInsertRowid: id };
          }
          if (sql.includes('INSERT INTO commands')) {
            const [command, approved] = args;
            const id = db._id++;
            db.commands.push({ id, command, approved, result: null, executed: 0, created_at: now });
            saveDb(db);
            return { lastInsertRowid: id };
          }
          if (sql.includes('UPDATE commands SET result')) {
            const [result, id] = args;
            const c = db.commands.find(x => x.id === id);
            if (c) { c.result = result; c.executed = 1; }
            saveDb(db);
            return {};
          }
          if (sql.includes('UPDATE tasks SET status')) {
            const [status, id] = args;
            const t = db.tasks.find(x => x.id == id);
            if (t) { t.status = status; t.updated_at = now; }
            saveDb(db);
            return {};
          }
          if (sql.includes('INSERT INTO alerts')) {
            const [type, message, severity] = args;
            const id = db._id++;
            db.alerts.push({ id, type, message, severity, resolved: 0, created_at: now });
            saveDb(db);
            return { lastInsertRowid: id };
          }
          if (sql.includes('UPDATE alerts SET resolved')) {
            const [id] = args;
            const a = db.alerts.find(x => x.id == id);
            if (a) a.resolved = 1;
            saveDb(db);
            return {};
          }
          return {};
        },
        all: (...args) => {
          const db = loadDb();
          if (sql.includes('FROM tasks')) return db.tasks.slice().reverse();
          if (sql.includes('FROM alerts')) return db.alerts.slice().reverse().slice(0, 50);
          if (sql.includes('FROM commands')) return db.commands.slice().reverse();
          return [];
        },
        get: (...args) => {
          const db = loadDb();
          if (sql.includes('FROM tasks')) return db.tasks.find(t => t.id == args[0]) || null;
          return null;
        }
      };
    },
    exec: () => {}
  };
}

module.exports = { getDb };

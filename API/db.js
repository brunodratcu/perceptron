const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./emocoes.db');

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS historico_emocoes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uid TEXT,
    emocao TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
});

module.exports = db;

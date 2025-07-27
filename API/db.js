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





db.run(`
  CREATE TABLE IF NOT EXISTS respostas_binarias (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pergunta_id INTEGER,
    resposta TEXT, -- 'sim' ou 'nao'
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);





module.exports = db;

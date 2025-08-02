// db.js - Configuração do banco de dados SQLite
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Criar/conectar ao banco de dados
const dbPath = path.join(__dirname, 'pesquisas.db');
const db = new sqlite3.Database(dbPath);

// Inicializar tabelas
db.serialize(() => {
  // Tabela principal de pesquisas
  db.run(`CREATE TABLE IF NOT EXISTS pesquisas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uid_rfid TEXT NOT NULL,
    estado_inicial TEXT NOT NULL,
    status TEXT DEFAULT 'iniciada',
    diagnostico_final TEXT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Tabela de respostas das pesquisas
  db.run(`CREATE TABLE IF NOT EXISTS respostas_pesquisa (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pesquisa_id INTEGER NOT NULL,
    pergunta_id INTEGER NOT NULL,
    resposta TEXT NOT NULL CHECK(resposta IN ('sim', 'nao')),
    comando_voz TEXT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (pesquisa_id) REFERENCES pesquisas(id),
    UNIQUE(pesquisa_id, pergunta_id)
  )`);

  // Índices para melhor performance
  db.run(`CREATE INDEX IF NOT EXISTS idx_pesquisas_uid ON pesquisas(uid_rfid)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_pesquisas_status ON pesquisas(status)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_pesquisas_diagnostico ON pesquisas(diagnostico_final)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_respostas_pesquisa ON respostas_pesquisa(pesquisa_id)`);
  
  console.log('✅ Banco de dados inicializado com sucesso!');
});

// Função para limpar dados antigos (opcional)
function limparDadosAntigos(dias = 30) {
  const dataLimite = new Date();
  dataLimite.setDate(dataLimite.getDate() - dias);
  
  db.run(`DELETE FROM respostas_pesquisa WHERE pesquisa_id IN (
    SELECT id FROM pesquisas WHERE timestamp < ?
  )`, [dataLimite.toISOString()]);
  
  db.run(`DELETE FROM pesquisas WHERE timestamp < ?`, [dataLimite.toISOString()], function(err) {
    if (err) {
      console.error('Erro ao limpar dados antigos:', err);
    } else {
      console.log(`🧹 Removidas ${this.changes} pesquisas antigas (mais de ${dias} dias)`);
    }
  });
}

// Função para obter estatísticas do banco
function obterEstatisticasDB(callback) {
  db.get(`SELECT 
    COUNT(*) as total_pesquisas,
    COUNT(CASE WHEN status = 'concluida' THEN 1 END) as concluidas,
    COUNT(CASE WHEN status = 'iniciada' THEN 1 END) as iniciadas,
    COUNT(CASE WHEN status = 'em_andamento' THEN 1 END) as em_andamento
  FROM pesquisas`, [], callback);
}

module.exports = {
  db,
  limparDadosAntigos,
  obterEstatisticasDB
};

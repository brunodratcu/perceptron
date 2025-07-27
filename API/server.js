
/* 
const express = require('express');
const http = require('http');
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let currentUID = "";

const port = new SerialPort({ path: '/dev/ttyUSB0', baudRate: 115200 });
const parser = port.pipe(new ReadlineParser({ delimiter: '\n' }));

parser.on('data', (data) => {
  console.log("UID recebido:", data.trim());
  currentUID = data.trim();

  // Envia para o frontend via WebSocket
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(currentUID);
    }
  });
});

app.use(express.static('public'));

server.listen(3000, () => {
  console.log('Servidor em http://localhost:3000');
});
*/
/*
parser.on('data', (data) => {
  const uid = data.trim();
  currentUID = uid;

  console.log("UID recebido:", uid);

  // Mapeamento UID → Emoção
  const mapa = {
    "a1b2c3": "Feliz",
    "d4e5f6": "Triste",
    "deadbeef": "Bravo"
  };

  const emocao = mapa[uid] || "Desconhecida";

  // Salvar no banco
  db.run(`INSERT INTO historico_emocoes (uid, emocao) VALUES (?, ?)`, [uid, emocao], (err) => {
    if (err) console.error("Erro ao inserir no banco:", err);
    else console.log("Registrado:", uid, emocao);
  });

  // Enviar para a interface
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(uid);
    }
  });
});
*/


const express = require('express');
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const WebSocket = require('ws');
const db = require('./db');
const cors = require('cors');

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Conexão com Serial
const serial = new SerialPort({ path: '/dev/ttyUSB0', baudRate: 115200 });
const parser = serial.pipe(new ReadlineParser({ delimiter: '\n' }));

// WebSocket Server
const wss = new WebSocket.Server({ port: 8080 });

// Mapeamento de UID para emoção
function mapear(uid) {
  const mapa = {
    "a1b2c3": "Feliz",
    "deadbeef": "Triste"
  };
  return mapa[uid] || "Desconhecido";
}

// Ao receber dado do ESP32 pela serial
parser.on('data', (data) => {
  const uid = data.trim();
  const emocao = mapear(uid);

  // Salva no banco
  db.run("INSERT INTO historico_emocoes (uid, emocao) VALUES (?, ?)", [uid, emocao]);

  // Envia para os clientes WebSocket
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ uid, emocao }));
    }
  });
});


// 📘 ROTAS REST --------------------------------------------

// GET: todos os registros
app.get('/api/emocoes', (req, res) => {
  db.all("SELECT * FROM historico_emocoes ORDER BY timestamp DESC", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// GET: um registro por ID
app.get('/api/emocoes/:id', (req, res) => {
  const id = req.params.id;
  db.get("SELECT * FROM historico_emocoes WHERE id = ?", [id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Registro não encontrado' });
    res.json(row);
  });
});

// POST: adicionar manualmente um novo registro
app.post('/api/emocoes', (req, res) => {
  const { uid, emocao } = req.body;
  if (!uid || !emocao) {
    return res.status(400).json({ error: "Campos 'uid' e 'emocao' são obrigatórios" });
  }
  db.run("INSERT INTO historico_emocoes (uid, emocao) VALUES (?, ?)", [uid, emocao], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json({ id: this.lastID, uid, emocao });
  });
});

// DELETE: apagar um registro por ID
app.delete('/api/emocoes/:id', (req, res) => {
  const id = req.params.id;
  db.run("DELETE FROM historico_emocoes WHERE id = ?", [id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: "Registro não encontrado" });
    res.json({ message: `Registro ${id} deletado com sucesso.` });
  });
});

// DELETE: apagar todos os registros
app.delete('/api/emocoes', (req, res) => {
  db.run("DELETE FROM historico_emocoes", function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: "Todos os registros foram deletados." });
  });
});




// API para registrar respostas binarias
// POST: resposta binária do robô
app.post('/api/responder', (req, res) => {
  const { pergunta_id, resposta } = req.body;
  if (!pergunta_id || !["sim", "nao"].includes(resposta)) {
    return res.status(400).json({ erro: "Dados inválidos" });
  }

  db.run("INSERT INTO respostas_binarias (pergunta_id, resposta) VALUES (?, ?)", [pergunta_id, resposta], function(err) {
    if (err) return res.status(500).json({ erro: err.message });
    res.json({ id: this.lastID, pergunta_id, resposta });
  });
});






//Rotas para resumo estatico (JSON para dashboard)
// GET: resumo de respostas
app.get('/api/resumo', (req, res) => {
  const perguntas = [
    "Dia foi satisfatório?",
    "Teve energia suficiente?",
    "Foi produtivo?",
    "Carga de trabalho justa?",
    "Sentiu-se valorizado?",
    "Comunicação foi clara?",
    "Desafios estimulantes?",
    "Fez pausas adequadas?"
  ];

  const sim = Array(8).fill(0);
  const nao = Array(8).fill(0);

  db.all("SELECT pergunta_id, resposta FROM respostas_binarias", [], (err, rows) => {
    if (err) return res.status(500).json({ erro: err.message });

    rows.forEach(({ pergunta_id, resposta }) => {
      if (resposta === "sim") sim[pergunta_id - 1]++;
      if (resposta === "nao") nao[pergunta_id - 1]++;
    });

    res.json({ perguntas, sim, nao });
  });
});













// Rota para geração de relatório
const { Parser } = require('json2csv');
const fs = require('fs');

// GET: relatório para empresa (CSV)
app.get('/api/relatorio', (req, res) => {
  db.all("SELECT * FROM respostas_binarias", [], (err, rows) => {
    if (err) return res.status(500).json({ erro: err.message });

    const fields = ['id', 'pergunta_id', 'resposta', 'timestamp'];
    const parser = new Parser({ fields });
    const csv = parser.parse(rows);

    fs.writeFileSync('relatorio.csv', csv);
    res.download('relatorio.csv');
  });
});




// -------------------------------------------------------------

// Iniciar servidor
app.listen(port, () => {
  console.log(`API rodando em http://localhost:${port}`);
});


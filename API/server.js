const express = require('express');
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const WebSocket = require('ws');
const db = require('./db');

const app = express();
const port = 3000;
const serial = new SerialPort({ path: '/dev/ttyUSB0', baudRate: 115200 });
const parser = serial.pipe(new ReadlineParser({ delimiter: '\n' }));
const wss = new WebSocket.Server({ port: 8080 });

app.use(express.static('public'));

// WebSocket envia UID para o frontend
parser.on('data', (data) => {
  const uid = data.trim();
  const emocao = mapear(uid);

  // Grava no banco
  db.run("INSERT INTO historico_emocoes (uid, emocao) VALUES (?, ?)", [uid, emocao]);

  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ uid, emocao }));
    }
  });
});

app.listen(port, () => console.log(`API rodando em http://localhost:${port}`));

function mapear(uid) {
  const mapa = {
    "a1b2c3": "Feliz",
    "deadbeef": "Triste"
  };
  return mapa[uid] || "Desconhecido";
}

const express = require('express');
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const WebSocket = require('ws');
const db = require('./db');
const cors = require('cors');
const { Parser } = require('json2csv');
const fs = require('fs');
const { format } = require('@fast-csv/format');

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Configuração da porta serial (opcional - descomente se usar ESP32)
// const serial = new SerialPort({ path: '/dev/ttyUSB0', baudRate: 115200 });
// const parser = serial.pipe(new ReadlineParser({ delimiter: '\n' }));

// WebSocket Server
const wss = new WebSocket.Server({ port: 8080 });

// Perguntas da pesquisa psicossocial
const PERGUNTAS_PESQUISA = [
  "Seu dia foi satisfatório?",
  "Você teve energia suficiente?",
  "Você foi produtivo hoje?",
  "A carga de trabalho foi justa?",
  "Você se sentiu valorizado?",
  "A comunicação foi clara?",
  "Os desafios foram estimulantes?",
  "Você fez pausas adequadas?"
];

// Mapeamento de UID RFID para estado emocional inicial
function mapearEstadoInicial(uid) {
  const mapa = {
    "feliz": "Feliz",
    "triste": "Triste", 
    "surpreso": "Surpreso",
    "a1b2c3": "Feliz",
    "deadbeef": "Triste",
    "cafe123": "Surpreso"
  };
  return mapa[uid] || "Neutro";
}

// Função para calcular diagnóstico emocional final
function calcularDiagnostico(respostas, estadoInicial) {
  const positivos = respostas.filter(r => r.resposta === "sim").length;
  const negativos = respostas.filter(r => r.resposta === "nao").length;
  const total = respostas.length;
  
  // Peso do estado inicial (30%) + peso das respostas (70%)
  let scoreInicial = 0;
  if (estadoInicial === "Feliz") scoreInicial = 0.3;
  else if (estadoInicial === "Triste") scoreInicial = -0.3;
  else if (estadoInicial === "Surpreso") scoreInicial = 0.1;
  
  let scoreRespostas = 0;
  if (total > 0) {
    scoreRespostas = ((positivos - negativos) / total) * 0.7;
  }
  
  const scoreFinal = scoreInicial + scoreRespostas;
  
  if (scoreFinal > 0.2) return "Feliz";
  else if (scoreFinal < -0.2) return "Triste";
  else return "Neutro";
}

// =====================================================
// ROTAS REST API
// =====================================================

// 1. RECEBER TAG RFID E CRIAR NOVA PESQUISA
app.post('/api/rfid/scan', (req, res) => {
  const { uid_rfid } = req.body;
  
  if (!uid_rfid) {
    return res.status(400).json({ error: "Campo 'uid_rfid' é obrigatório" });
  }
  
  const estadoInicial = mapearEstadoInicial(uid_rfid);
  
  // Criar nova pesquisa no banco
  db.run("INSERT INTO pesquisas (uid_rfid, estado_inicial, status) VALUES (?, ?, 'iniciada')", 
    [uid_rfid, estadoInicial], 
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      const pesquisaId = this.lastID;
      
      // Notificar via WebSocket
      wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({ 
            tipo: 'nova_pesquisa',
            pesquisa_id: pesquisaId,
            uid_rfid, 
            estado_inicial: estadoInicial,
            perguntas: PERGUNTAS_PESQUISA
          }));
        }
      });
      
      res.status(201).json({ 
        pesquisa_id: pesquisaId,
        uid_rfid,
        estado_inicial: estadoInicial,
        status: 'iniciada',
        perguntas: PERGUNTAS_PESQUISA
      });
    }
  );
});

// 2. REGISTRAR RESPOSTA DE VOZ PARA UMA PERGUNTA
app.post('/api/pesquisas/:pesquisa_id/resposta', (req, res) => {
  const { pesquisa_id } = req.params;
  const { pergunta_id, resposta, comando_voz } = req.body;
  
  if (!pergunta_id || !["sim", "nao"].includes(resposta)) {
    return res.status(400).json({ 
      error: "Campos obrigatórios: pergunta_id (1-8), resposta ('sim' ou 'nao')" 
    });
  }
  
  // Verificar se a pesquisa existe
  db.get("SELECT * FROM pesquisas WHERE id = ?", [pesquisa_id], (err, pesquisa) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!pesquisa) return res.status(404).json({ error: "Pesquisa não encontrada" });
    
    // Registrar resposta
    db.run("INSERT INTO respostas_pesquisa (pesquisa_id, pergunta_id, resposta, comando_voz) VALUES (?, ?, ?, ?)",
      [pesquisa_id, pergunta_id, resposta, comando_voz || null],
      function(err) {
        if (err) return res.status(500).json({ error: err.message });
        
        // Verificar se todas as perguntas foram respondidas
        db.all("SELECT * FROM respostas_pesquisa WHERE pesquisa_id = ?", [pesquisa_id], (err, respostas) => {
          if (err) return res.status(500).json({ error: err.message });
          
          let statusPesquisa = 'em_andamento';
          let diagnosticoFinal = null;
          
          if (respostas.length >= PERGUNTAS_PESQUISA.length) {
            // Pesquisa completa - calcular diagnóstico
            diagnosticoFinal = calcularDiagnostico(respostas, pesquisa.estado_inicial);
            statusPesquisa = 'concluida';
            
            // Atualizar status da pesquisa
            db.run("UPDATE pesquisas SET status = ?, diagnostico_final = ? WHERE id = ?",
              [statusPesquisa, diagnosticoFinal, pesquisa_id]);
          }
          
          // Notificar via WebSocket
          wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({
                tipo: 'resposta_registrada',
                pesquisa_id,
                pergunta_id,
                resposta,
                total_respostas: respostas.length,
                status: statusPesquisa,
                diagnostico_final: diagnosticoFinal
              }));
            }
          });
          
          res.json({
            id: this.lastID,
            pesquisa_id,
            pergunta_id,
            resposta,
            progresso: `${respostas.length}/${PERGUNTAS_PESQUISA.length}`,
            status: statusPesquisa,
            diagnostico_final: diagnosticoFinal
          });
        });
      }
    );
  });
});

// 3. OBTER RESUMO DE UMA PESQUISA ESPECÍFICA
app.get('/api/pesquisas/:id/resumo', (req, res) => {
  const { id } = req.params;
  
  db.get("SELECT * FROM pesquisas WHERE id = ?", [id], (err, pesquisa) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!pesquisa) return res.status(404).json({ error: "Pesquisa não encontrada" });
    
    db.all("SELECT * FROM respostas_pesquisa WHERE pesquisa_id = ? ORDER BY pergunta_id", [id], (err, respostas) => {
      if (err) return res.status(500).json({ error: err.message });
      
      const resumo = {
        pesquisa_id: id,
        uid_rfid: pesquisa.uid_rfid,
        estado_inicial: pesquisa.estado_inicial,
        status: pesquisa.status,
        diagnostico_final: pesquisa.diagnostico_final,
        timestamp: pesquisa.timestamp,
        perguntas: PERGUNTAS_PESQUISA.map((pergunta, index) => {
          const resposta = respostas.find(r => r.pergunta_id === index + 1);
          return {
            id: index + 1,
            pergunta,
            resposta: resposta ? resposta.resposta : 'pendente',
            comando_voz: resposta ? resposta.comando_voz : null,
            timestamp: resposta ? resposta.timestamp : null
          };
        }),
        estatisticas: {
          total_perguntas: PERGUNTAS_PESQUISA.length,
          respondidas: respostas.length,
          sim: respostas.filter(r => r.resposta === 'sim').length,
          nao: respostas.filter(r => r.resposta === 'nao').length
        }
      };
      
      res.json(resumo);
    });
  });
});

// 4. LISTAR TODAS AS PESQUISAS (DASHBOARD)
app.get('/api/pesquisas', (req, res) => {
  const { status } = req.query;
  
  let query = "SELECT * FROM pesquisas";
  let params = [];
  
  if (status) {
    query += " WHERE status = ?";
    params.push(status);
  }
  
  query += " ORDER BY timestamp DESC";
  
  db.all(query, params, (err, pesquisas) => {
    if (err) return res.status(500).json({ error: err.message });
    
    res.json({
      total: pesquisas.length,
      pesquisas: pesquisas.map(p => ({
        id: p.id,
        uid_rfid: p.uid_rfid,
        estado_inicial: p.estado_inicial,
        status: p.status,
        diagnostico_final: p.diagnostico_final,
        timestamp: p.timestamp
      }))
    });
  });
});

// 5. ESTATÍSTICAS GERAIS PARA DASHBOARD
app.get('/api/dashboard/estatisticas', (req, res) => {
  // Estatísticas por diagnóstico final
  db.all("SELECT diagnostico_final, COUNT(*) as total FROM pesquisas WHERE status = 'concluida' GROUP BY diagnostico_final", [], (err, diagnosticos) => {
    if (err) return res.status(500).json({ error: err.message });
    
    // Estatísticas por estado inicial
    db.all("SELECT estado_inicial, COUNT(*) as total FROM pesquisas GROUP BY estado_inicial", [], (err, estadosIniciais) => {
      if (err) return res.status(500).json({ error: err.message });
      
      // Estatísticas gerais
      db.get("SELECT COUNT(*) as total, COUNT(CASE WHEN status = 'concluida' THEN 1 END) as concluidas FROM pesquisas", [], (err, geral) => {
        if (err) return res.status(500).json({ error: err.message });
        
        res.json({
          geral: {
            total_pesquisas: geral.total,
            pesquisas_concluidas: geral.concluidas,
            pesquisas_pendentes: geral.total - geral.concluidas
          },
          diagnosticos_finais: diagnosticos.reduce((acc, d) => {
            acc[d.diagnostico_final || 'Em andamento'] = d.total;
            return acc;
          }, {}),
          estados_iniciais: estadosIniciais.reduce((acc, e) => {
            acc[e.estado_inicial] = e.total;
            return acc;
          }, {}),
          timestamp: new Date().toISOString()
        });
      });
    });
  });
});

// 6. EXPORTAR RELATÓRIO CSV
app.get('/api/relatorio/csv', (req, res) => {
  const query = `
    SELECT 
      p.id as pesquisa_id,
      p.uid_rfid,
      p.estado_inicial,
      p.status,
      p.diagnostico_final,
      p.timestamp as data_pesquisa,
      rp.pergunta_id,
      rp.resposta,
      rp.comando_voz,
      rp.timestamp as data_resposta
    FROM pesquisas p
    LEFT JOIN respostas_pesquisa rp ON p.id = rp.pesquisa_id
    ORDER BY p.timestamp DESC, rp.pergunta_id ASC
  `;
  
  db.all(query, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    
    const filePath = './relatorio_pesquisas.csv';
    const fields = ['pesquisa_id', 'uid_rfid', 'estado_inicial', 'status', 'diagnostico_final', 'data_pesquisa', 'pergunta_id', 'resposta', 'comando_voz', 'data_resposta'];
    
    try {
      const parser = new Parser({ fields });
      const csv = parser.parse(rows);
      
      fs.writeFileSync(filePath, csv);
      res.download(filePath, 'relatorio_pesquisas.csv');
    } catch (error) {
      res.status(500).json({ error: 'Erro ao gerar CSV: ' + error.message });
    }
  });
});

// 7. DELETAR PESQUISA
app.delete('/api/pesquisas/:id', (req, res) => {
  const { id } = req.params;
  
  // Deletar respostas primeiro
  db.run("DELETE FROM respostas_pesquisa WHERE pesquisa_id = ?", [id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    
    // Deletar pesquisa
    db.run("DELETE FROM pesquisas WHERE id = ?", [id], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: "Pesquisa não encontrada" });
      
      res.json({ message: `Pesquisa ${id} deletada com sucesso` });
    });
  });
});

// 8. ROTA PARA TESTAR MAPEAMENTO DE RFID
app.get('/api/rfid/test/:uid', (req, res) => {
  const { uid } = req.params;
  const estado = mapearEstadoInicial(uid);
  
  res.json({
    uid_rfid: uid,
    estado_mapeado: estado,
    todos_mapeamentos: {
      "feliz": "Feliz",
      "triste": "Triste", 
      "surpreso": "Surpreso",
      "a1b2c3": "Feliz",
      "deadbeef": "Triste",
      "cafe123": "Surpreso"
    }
  });
});

// =====================================================
// HANDLERS PARA SERIAL PORT (OPCIONAL)
// =====================================================

// Descomente se estiver usando ESP32 via serial
/*
parser.on('data', (data) => {
  const uid = data.trim();
  
  // Processar automaticamente quando receber UID da serial
  const estadoInicial = mapearEstadoInicial(uid);
  
  db.run("INSERT INTO pesquisas (uid_rfid, estado_inicial, status) VALUES (?, ?, 'iniciada')", 
    [uid, estadoInicial], 
    function(err) {
      if (err) {
        console.error("Erro ao registrar pesquisa via serial:", err);
        return;
      }
      
      const pesquisaId = this.lastID;
      console.log(`Nova pesquisa criada via RFID: ${pesquisaId} - UID: ${uid} - Estado: ${estadoInicial}`);
      
      // Notificar via WebSocket
      wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({ 
            tipo: 'nova_pesquisa_rfid',
            pesquisa_id: pesquisaId,
            uid_rfid: uid, 
            estado_inicial: estadoInicial,
            perguntas: PERGUNTAS_PESQUISA
          }));
        }
      });
    }
  );
});
*/

// =====================================================
// INICIALIZAÇÃO DO SERVIDOR
// =====================================================

app.listen(port, () => {
  console.log(`🚀 Servidor rodando em http://localhost:${port}`);
  console.log(`📡 WebSocket rodando na porta 8080`);
  console.log(`\n📋 Endpoints disponíveis:`);
  console.log(`POST /api/rfid/scan - Registrar tag RFID e iniciar pesquisa`);
  console.log(`POST /api/pesquisas/:id/resposta - Registrar resposta de voz`);
  console.log(`GET  /api/pesquisas/:id/resumo - Obter resumo da pesquisa`);
  console.log(`GET  /api/pesquisas - Listar todas as pesquisas`);
  console.log(`GET  /api/dashboard/estatisticas - Estatísticas para dashboard`);
  console.log(`GET  /api/relatorio/csv - Exportar relatório CSV`);
  console.log(`GET  /api/rfid/test/:uid - Testar mapeamento RFID`);
});

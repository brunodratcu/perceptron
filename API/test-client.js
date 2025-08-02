// test-client.js - Cliente para testar a API
const axios = require('axios');
const WebSocket = require('ws');

const BASE_URL = 'http://localhost:3000/api';
const WS_URL = 'ws://localhost:8080';

class TestClient {
  constructor() {
    this.ws = null;
    this.conectarWebSocket();
  }

  conectarWebSocket() {
    this.ws = new WebSocket(WS_URL);
    
    this.ws.on('open', () => {
      console.log('🔌 Conectado ao WebSocket');
    });
    
    this.ws.on('message', (data) => {
      const message = JSON.parse(data);
      console.log('📨 WebSocket:', message);
    });
    
    this.ws.on('error', (error) => {
      console.error('❌ Erro WebSocket:', error.message);
    });
  }

  async testarSistemaCompleto() {
    console.log('🧪 Iniciando teste completo do sistema...\n');

    try {
      // 1. Testar mapeamento RFID
      console.log('1️⃣ Testando mapeamento RFID...');
      const testRfid = await axios.get(`${BASE_URL}/rfid/test/feliz`);
      console.log('✅ Mapeamento:', testRfid.data);

      // 2. Simular leitura de tag RFID
      console.log('\n2️⃣ Simulando leitura de tag RFID...');
      const novaPesquisa = await axios.post(`${BASE_URL}/rfid/scan`, {
        uid_rfid: 'feliz'
      });
      console.log('✅ Nova pesquisa criada:', novaPesquisa.data);
      
      const pesquisaId = novaPesquisa.data.pesquisa_id;

      // 3. Simular respostas de voz
      console.log('\n3️⃣ Simulando respostas de voz...');
      const respostas = [
        { pergunta: 1, resposta: 'sim', voz: 'Sim, foi muito bom' },
        { pergunta: 2, resposta: 'sim', voz: 'Sim, tive bastante energia' },
        { pergunta: 3, resposta: 'nao', voz: 'Não, poderia ter sido melhor' },
        { pergunta: 4, resposta: 'sim', voz: 'Sim, foi equilibrada' },
        { pergunta: 5, resposta: 'sim', voz: 'Sim, me senti reconhecido' },
        { pergunta: 6, resposta: 'nao', voz: 'Não, faltou clareza' },
        { pergunta: 7, resposta: 'sim', voz: 'Sim, foram interessantes' },
        { pergunta: 8, resposta: 'sim', voz: 'Sim, fiz pausas regulares' }
      ];

      for (const resp of respostas) {
        const resultado = await axios.post(`${BASE_URL}/pesquisas/${pesquisaId}/resposta`, {
          pergunta_id: resp.pergunta,
          resposta: resp.resposta,
          comando_voz: resp.voz
        });
        console.log(`✅ Pergunta ${resp.pergunta}: ${resp.resposta} (${resultado.data.status})`);
        
        // Aguardar um pouco entre respostas
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // 4. Obter resumo da pesquisa
      console.log('\n4️⃣ Obtendo resumo da pesquisa...');
      const resumo = await axios.get(`${BASE_URL}/pesquisas/${pesquisaId}/resumo`);
      console.log('✅ Resumo:', {
        id: resumo.data.pesquisa_id,
        estado_inicial: resumo.data.estado_inicial,
        diagnostico_final: resumo.data.diagnostico_final,
        estatisticas: resumo.data.estatisticas
      });

      // 5. Verificar dashboard
      console.log('\n5️⃣ Consultando estatísticas do dashboard...');
      const stats = await axios.get(`${BASE_URL}/dashboard/estatisticas`);
      console.log('✅ Estatísticas:', stats.data);

      // 6. Listar todas as pesquisas
      console.log('\n6️⃣ Listando todas as pesquisas...');
      const todasPesquisas = await axios.get(`${BASE_URL}/pesquisas`);
      console.log(`✅ Total de pesquisas: ${todasPesquisas.data.total}`);

      console.log('\n🎉 Teste completo finalizado com sucesso!');

    } catch (error) {
      console.error('❌ Erro durante o teste:', error.response?.data || error.message);
    }
  }

  async criarPesquisasDemo() {
    console.log('📊 Criando dados de demonstração...\n');

    const uids = ['feliz', 'triste', 'surpreso', 'cafe123', 'deadbeef'];
    const respostasModelos = [
      // Pesquisa muito positiva
      ['sim', 'sim', 'sim', 'sim', 'sim', 'sim', 'sim', 'sim'],
      // Pesquisa negativa
      ['nao', 'nao', 'nao', 'nao', 'nao', 'sim', 'nao', 'nao'],
      // Pesquisa neutra
      ['sim', 'nao', 'sim', 'nao', 'sim', 'nao', 'sim', 'nao'],
      // Pesquisa mais positiva
      ['sim', 'sim', 'sim', 'sim', 'nao', 'sim', 'sim', 'sim'],
      // Pesquisa mais negativa
      ['nao', 'nao', 'sim', 'nao', 'nao', 'nao', 'nao', 'sim']
    ];

    for (let i = 0; i < uids.length; i++) {
      try {
        // Criar pesquisa
        const pesquisa = await axios.post(`${BASE_URL}/rfid/scan`, {
          uid_rfid: uids[i]
        });

        const pesquisaId = pesquisa.data.pesquisa_id;
        console.log(`📝 Criada pesquisa ${pesquisaId} para UID: ${uids[i]}`);

        // Adicionar respostas
        const respostas = respostasModelos[i];
        for (let j = 0; j < respostas.length; j++) {
          await axios.post(`${BASE_URL}/pesquisas/${pesquisaId}/resposta`, {
            pergunta_id: j + 1,
            resposta: respostas[j],
            comando_voz: `Resposta ${respostas[j]} para pergunta ${j + 1}`
          });
        }

        console.log(`✅ Pesquisa ${pesquisaId} completada`);
        
      } catch (error) {
        console.error(`❌ Erro ao criar pesquisa ${i + 1}:`, error.response?.data || error.message);
      }
    }

    console.log('\n📈 Dados de demonstração criados!');
  }

# PERCEPTRON
# 🤖 Robô Animatrônico Interativo – Pesquisa Psicossocial

Este projeto implementa um **robô de mesa animatrônico interativo**, que atua como entrevistador de uma **pesquisa psicossocial**, usando expressões faciais, reconhecimento de voz e roupas com etiquetas RFID para interpretar os sentimentos do usuário.

O robô se conecta via **USB** ao computador (ESP32) e exibe seu "avatar virtual" em uma interface web, que responde dinamicamente às emoções detectadas pelas roupas e às respostas de um questionário.

---

## 📦 Funcionalidades

- 🧠 Reconhecimento de emoções via **etiquetas RFID/NFC**
- 💬 Questionário psicossocial com respostas Sim/Não
- 😄 Avatar virtual animado que reage às emoções detectadas
- 🧥 Uso de vestimentas RFID para representar sentimentos
- 💾 Armazenamento em banco de dados SQLite
- 📈 Dashboard com resumo das emoções e respostas
- 📤 Exportação de relatórios CSV
- ✉️ Envio dos relatórios por e-mail para empresa

---

## 🔧 Tecnologias Utilizadas

- **ESP32** – Microcontrolador para leitura dos sensores (RFID, voz)
- **Node.js + Express** – Backend da API e leitura da serial
- **WebSocket** – Comunicação em tempo real com o frontend
- **SQLite3** – Banco de dados local
- **SerialPort** – Biblioteca para ler a serial do ESP32
- **Fast-CSV / json2csv** – Exportação de dados para CSV
- **Nodemailer** – Envio de relatórios por e-mail
- **Chart.js** – Visualização dos dados no dashboard

---

## 🚀 Como rodar o projeto localmente

1. **Clone o repositório**:

```bash
git clone https://github.com/brunodratcu/perceptron.git
cd magic_mirror_project
```

2. **Instale as dependências**:

```bash
npm install
```

3. **Configure a porta serial no `server.js`**:

> Altere `/dev/ttyUSB0` para a porta onde o ESP32 está conectado, como:
> - `COM3` (Windows)
> - `/dev/ttyUSB0` ou `/dev/tty.SLAB_USBtoUART` (Linux/macOS)

4. **Inicie o servidor**:

```bash
npm start
```

Acesse [http://localhost:3000](http://localhost:3000) no navegador.

---

## 📡 API REST – Emoções via RFID

### 🔍 POST `/api/emocoes`

Registra manualmente um UID e sua emoção associada (caso o ESP32 não envie automaticamente).

**Body JSON:**
```json
{
  "uid": "a1b2c3",
  "emocao": "Feliz"
}
```

**Resposta:**
```json
{
  "id": 1,
  "uid": "a1b2c3",
  "emocao": "Feliz"
}
```

---

### 🔍 GET `/api/emocoes`

Retorna **todos os registros** do histórico de emoções:

**Resposta:**
```json
[
  { "id": 1, "uid": "a1b2c3", "emocao": "Feliz", "timestamp": "2025-08-02 12:00:00" },
  { "id": 2, "uid": "deadbeef", "emocao": "Triste", "timestamp": "2025-08-02 12:05:00" }
]
```

---

### 🔍 GET `/api/emocoes/:id`

Retorna um único registro de emoção.

---

### ❌ DELETE `/api/emocoes/:id`

Deleta um registro específico.

---

### ❌ DELETE `/api/emocoes`

Remove **todos os registros** da tabela de emoções.

---

## 📘 UID → Emoções (mapa no backend)

O mapeamento dos UIDs das roupas para emoções é feito diretamente no backend:

```js
const mapa = {
  "a1b2c3": "Feliz",
  "deadbeef": "Triste"
};
```

Você pode expandir esse mapa para:

- 😄 "Feliz"
- 😔 "Triste"
- 😡 "Bravo"
- 😨 "Ansioso"
- 😐 "Neutro"

Cada peça de roupa (ou acessório) terá um UID correspondente a uma dessas emoções.

---

## 📬 Rota para envio do relatório por e-mail

### GET `/api/relatorio/email`

Gera o relatório `.csv` com as respostas e envia como anexo para o e-mail configurado no backend.

---

## 📁 Relatórios CSV disponíveis

- `/api/relatorio` → respostas binárias
- `/api/relatorio/csv` → respostas anônimas

---


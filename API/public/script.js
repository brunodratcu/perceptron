const socket = new WebSocket('ws://localhost:8080');
socket.onmessage = (msg) => {
  const { uid, emocao } = JSON.parse(msg.data);
  document.getElementById('emocao').innerText = `Emoção: ${emocao}`;

  let src = 'default.png';
  if (emocao === "Feliz") src = 'feliz.png';
  else if (emocao === "Triste") src = 'triste.png';

  document.getElementById('robo').src = src;
};

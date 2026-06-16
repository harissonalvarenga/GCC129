import { WebSocketServer, WebSocket } from 'ws';

const PORT = 8080;
const wss = new WebSocketServer({ port: PORT });

wss.on('connection', (ws: WebSocket) => {
  console.log('🌱 Novo agricultor conectado ao Gateway!');

  ws.on('message', async (data: Buffer) => {
    try {
      const userPayload = JSON.parse(data.toString());

      const response = await fetch('http://orchestrator:8000/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userPayload),
      });

      if (!response.ok || !response.body) {
        throw new Error(`Orchestrator retornou ${response.status}`);
      }

      // Forward each NDJSON line from the orchestrator directly to the WebSocket client.
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';
        for (const line of lines) {
          if (line.trim() && ws.readyState === WebSocket.OPEN) {
            ws.send(line);
          }
        }
      }

    } catch (error) {
      console.error('Erro no processamento:', error);
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'error', message: 'Erro ao consultar o sistema.' }));
      }
    }
  });

  ws.on('close', () => console.log('Conexão encerrada pelo cliente.'));
});

console.log(`🚀 Gateway WebSocket rodando na porta ${PORT}`);

import { WebSocketServer, WebSocket } from 'ws';

const PORT = 8080;
const wss = new WebSocketServer({ port: PORT });

wss.on('connection', (ws: WebSocket) => {
    console.log('🌱 Novo agricultor conectado ao Gateway!');

    ws.on('message', async (data: Buffer) => {
        try {
            const userPayload = JSON.parse(data.toString());
            console.log('Mensagem recebida:', userPayload);

            const orchestratorResponse = await fetch('http://orchestrator:8000/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(userPayload)
            });

            if (!orchestratorResponse.ok) {
                throw new Error(`HTTP error! status: ${orchestratorResponse.status}`);
            }

            const result = await orchestratorResponse.json();
            ws.send(JSON.stringify(result));

        } catch (error) {
            console.error('Erro no processamento:', error);
            ws.send(JSON.stringify({ error: "Erro ao consultar o sistema inteligente." }));
        }
    });

    ws.on('close', () => {
        console.log('Conexão encerrada pelo cliente.');
    });
});

console.log(`🚀 Gateway WebSocket rodando na porta ${PORT}`);
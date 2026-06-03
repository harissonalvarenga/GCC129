import "dotenv/config";
import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { z } from "zod";

const app = express();

const mcp = new McpServer({
    name: "agro-tools",
    version: "1.0.0"
});

mcp.tool("get_weather",
    "Busca a previsão do tempo atual para uma cidade específica",
    { location: z.string().describe("O nome da cidade. Ex: Lavras") },
    async ({ location }) => {
        try {
            const apiKey = process.env.WEATHER_API_KEY || "TEST_KEY";

            if (apiKey === "TEST_KEY") {
                return { content: [{ type: "text", text: `Clima simulado em ${location}: 28°C, Ensolarado.` }] };
            }

            const res = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=${location}&appid=${apiKey}&units=metric&lang=pt_br`);
            if (!res.ok) {
                console.log(res);
                throw new Error("API Externa falhou");
            }

            const data = await res.json();
            const resultado = `Clima em ${location}: ${data.weather[0].description}, ${data.main.temp}°C. Umidade: ${data.main.humidity}%`;

            return { content: [{ type: "text", text: resultado }] };
        } catch (e) {
            return { content: [{ type: "text", text: `Erro ao buscar o clima de ${location}.` }] };
        }
    }
);

let transport: SSEServerTransport;

app.get("/sse", async (req, res) => {
    console.log("Orquestrador conectou ao MCP via SSE");
    transport = new SSEServerTransport("/messages", res);
    await mcp.connect(transport);
});

app.post("/messages", async (req, res) => {
    if (transport) {
        await transport.handlePostMessage(req, res);
    } else {
        res.status(503).send("Conexão SSE não inicializada");
    }
});

const PORT = 3001;
app.listen(PORT, () => {
    console.log(`🛠️ MCP Server rodando na porta ${PORT}`);
    console.log(`📡 Endpoints disponíveis: GET /sse | POST /messages`);
});
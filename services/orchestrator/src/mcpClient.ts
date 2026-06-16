import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

// O mcp-server expõe a ferramenta get_weather via Model Context Protocol (SSE).
const MCP_URL = process.env.MCP_URL || "http://mcp-server:3001";

// Conecta UMA vez e reutiliza (a conexão SSE é persistente).
let clientPromise: Promise<Client> | null = null;

function getClient(): Promise<Client> {
  if (!clientPromise) {
    clientPromise = (async () => {
      const transport = new SSEClientTransport(new URL(`${MCP_URL}/sse`));
      const client = new Client(
        { name: "orchestrator", version: "1.0.0" },
        { capabilities: {} }
      );
      await client.connect(transport);
      return client;
    })();
  }
  return clientPromise;
}

export async function getWeather(location: string): Promise<string> {
  const client = await getClient();

  const result = await client.callTool({
    name: "get_weather",
    arguments: { location }
  });

  // O conteúdo da ferramenta vem como blocos { type: "text", text: ... }.
  const content = result.content as { type: string; text: string }[];
  return content
    .filter((c) => c.type === "text")
    .map((c) => c.text)
    .join(" ");
}

// Heurística simples para extrair a cidade da mensagem ("...em Lavras").
// Cidade padrão: Lavras (UFLA). Extração robusta seria via tool-calling do LLM.
const DEFAULT_CITY = process.env.DEFAULT_CITY || "Lavras";

export function extractCity(message: string): string {
  const match = message.match(/em\s+([A-ZÀ-Ú][\wÀ-ú]+)/);
  return match ? match[1] : DEFAULT_CITY;
}

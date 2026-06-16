import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { z } from "zod";

const app = express();

const mcp = new McpServer({ name: "agro-tools", version: "1.0.0" });

// WMO weather interpretation codes (subset, in Portuguese)
const WMO: Record<number, string> = {
  0: "céu limpo",
  1: "predominantemente limpo", 2: "parcialmente nublado", 3: "nublado",
  45: "nevoeiro", 48: "nevoeiro com geada depositada",
  51: "chuvisco leve", 53: "chuvisco moderado", 55: "chuvisco intenso",
  61: "chuva leve", 63: "chuva moderada", 65: "chuva forte",
  71: "neve leve", 73: "neve moderada", 75: "neve forte",
  80: "pancadas de chuva leves", 81: "pancadas de chuva moderadas", 82: "pancadas de chuva fortes",
  95: "trovoada", 96: "trovoada com granizo leve", 99: "trovoada com granizo forte",
};

interface GeoResult { lat: number; lon: number; name: string; region: string }

async function geocode(city: string): Promise<GeoResult> {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=pt&format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Geocoding falhou");
  const data = await res.json() as {
    results?: { latitude: number; longitude: number; name: string; admin1?: string }[]
  };
  if (!data.results?.length) throw new Error(`Cidade não encontrada: ${city}`);
  const r = data.results[0];
  return { lat: r.latitude, lon: r.longitude, name: r.name, region: r.admin1 ?? "" };
}

async function fetchForecast(lat: number, lon: number): Promise<any> {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    current: [
      "temperature_2m", "apparent_temperature", "relative_humidity_2m",
      "precipitation", "wind_speed_10m", "weather_code",
    ].join(","),
    daily: [
      "temperature_2m_max", "temperature_2m_min",
      "precipitation_sum", "precipitation_probability_max",
      "et0_fao_evapotranspiration",
    ].join(","),
    hourly: "soil_moisture_0_to_1cm,vapour_pressure_deficit",
    timezone: "America/Sao_Paulo",
    forecast_days: "3",
  });
  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
  if (!res.ok) throw new Error(`Open-Meteo falhou: ${res.status}`);
  return res.json();
}

function formatWeather(name: string, region: string, data: any): string {
  const c = data.current;
  const d = data.daily;
  const h = data.hourly;

  const condition = WMO[c.weather_code as number] ?? "condição desconhecida";
  const location  = region ? `${name} (${region})` : name;

  // Find the hourly index closest to the current observation time for soil data.
  const hourlyTimes = h.time as string[];
  const hIdx = Math.max(0, hourlyTimes.findIndex((t: string) => t >= (c.time as string)));

  const soilMoisture = (h.soil_moisture_0_to_1cm[hIdx] as number).toFixed(3);
  const vpd          = (h.vapour_pressure_deficit[hIdx] as number).toFixed(2);

  const lines = [
    `${location} — Previsão agroclimática`,
    `Agora: ${c.temperature_2m.toFixed(1)}°C (sensação ${c.apparent_temperature.toFixed(1)}°C), ${condition}, umidade ${c.relative_humidity_2m}%, vento ${c.wind_speed_10m.toFixed(1)} km/h`,
    `Hoje: mín ${d.temperature_2m_min[0].toFixed(1)}°C / máx ${d.temperature_2m_max[0].toFixed(1)}°C, chuva ${d.precipitation_sum[0].toFixed(1)}mm (prob. ${d.precipitation_probability_max[0]}%), ET₀ ${d.et0_fao_evapotranspiration[0].toFixed(2)}mm`,
    `Solo: umidade ${soilMoisture} m³/m³, déficit de pressão de vapor ${vpd} kPa`,
  ];

  if (d.temperature_2m_min[1] !== undefined)
    lines.push(`Amanhã: ${d.temperature_2m_min[1].toFixed(1)}–${d.temperature_2m_max[1].toFixed(1)}°C, chuva ${d.precipitation_sum[1].toFixed(1)}mm (prob. ${d.precipitation_probability_max[1]}%)`);

  if (d.temperature_2m_min[2] !== undefined)
    lines.push(`Depois de amanhã: ${d.temperature_2m_min[2].toFixed(1)}–${d.temperature_2m_max[2].toFixed(1)}°C, chuva ${d.precipitation_sum[2].toFixed(1)}mm (prob. ${d.precipitation_probability_max[2]}%)`);

  return lines.join("\n");
}

mcp.tool(
  "get_weather",
  "Busca previsão do tempo e dados agroclimáticos (temperatura, ET₀, umidade do solo, VPD) para uma cidade via Open-Meteo. Sem chave de API necessária.",
  { location: z.string().describe("Nome da cidade. Ex: Lavras") },
  async ({ location }) => {
    try {
      const { lat, lon, name, region } = await geocode(location);
      const data   = await fetchForecast(lat, lon);
      const result = formatWeather(name, region, data);
      return { content: [{ type: "text", text: result }] };
    } catch (e) {
      console.error(e);
      return { content: [{ type: "text", text: `Erro ao buscar o clima de ${location}.` }] };
    }
  }
);

let transport: SSEServerTransport | undefined;

app.get("/sse", async (req, res) => {
  console.log("Orquestrador conectou ao MCP via SSE");
  if (transport) {
    try { await transport.close(); } catch (_) {}
  }
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
  console.log(`📡 Open-Meteo ativo — GET /sse | POST /messages`);
});

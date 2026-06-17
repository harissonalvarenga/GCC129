import { Intent } from "./types";

const weatherKeywords = [
  "clima", "climático", "climática",
  "tempo",       // "como está o tempo", "baseado no tempo"
  "previsão",    // "previsão do tempo"
  "temperatura",
  "chuva", "chover", "chuvoso", "precipitação",
  "calor", "frio", "geada",
  "sol", "ensolarado", "nublado",
  "vento", "ventoso",
  "umidade",
  "seca",        // drought / dry conditions
];

export function hasWeatherIntent(message: string): boolean {
  const text = message.toLowerCase();
  return weatherKeywords.some(kw => text.includes(kw));
}

export function classifyIntent(
  message: string,
  hasImage: boolean
): Intent {

  if (hasImage) {
    return "vision";
  }

  if (hasWeatherIntent(message)) {
    return "weather";
  }

  return "rag";
}
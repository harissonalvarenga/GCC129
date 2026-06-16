import { Intent } from "./types";

export function classifyIntent(
  message: string,
  hasImage: boolean
): Intent {

  if (hasImage) {
    return "vision";
  }

  const text = message.toLowerCase();

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

  if (weatherKeywords.some(kw => text.includes(kw))) {
    return "weather";
  }

  return "rag";
}
import { Intent } from "./types";

export function classifyIntent(
  message: string,
  hasImage: boolean
): Intent {

  if (hasImage) {
    return "vision";
  }

  const text = message.toLowerCase();

  if (
    text.includes("clima") ||
    text.includes("chuva") ||
    text.includes("temperatura")
  ) {
    return "weather";
  }

  return "rag";
}
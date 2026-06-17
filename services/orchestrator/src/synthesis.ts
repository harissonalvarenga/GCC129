import { Chunk } from "./types";

const LLM_URL = process.env.LLM_URL || "http://llm-service:11434";
const LLM_MODEL = process.env.LLM_MODEL || "llama3.1:8b";

const SYSTEM_PROMPT =
  "Você é um agrônomo especialista em agricultura tropical e pecuária brasileira. " +
  "Responda em português brasileiro, de forma direta e prática (máximo 3 parágrafos curtos). " +
  "Use SOMENTE o conhecimento técnico fornecido abaixo. " +
  "Use etapas numeradas quando a resposta envolver procedimentos. " +
  "NÃO mencione fontes, arquivos, documentos ou base de dados. " +
  "NÃO repita que não tem certeza — dê a melhor orientação possível com o que sabe. " +
  "Se o conhecimento fornecido não cobrir a pergunta, diga brevemente que não tem informação suficiente. " +
  "NÃO invente dados agronômicos.";

interface ChatMessage { role: "system" | "user" | "assistant"; content: string }

export interface SynthesisInput {
  question: string;
  chunks: Chunk[];
  visionDiagnosis?: string;
  weather?: string;
  history?: { role: string; content: string }[];
}

function buildMessages(input: SynthesisInput): ChatMessage[] {
  const contextBlocks: string[] = [];

  if (input.visionDiagnosis) {
    contextBlocks.push(
      `OBSERVAÇÃO VISUAL DA LAVOURA:\n${input.visionDiagnosis}\n` +
      `Use esta observação junto com o conhecimento técnico para orientar o agricultor sobre manejo adequado.`
    );
  }
  if (input.weather) {
    contextBlocks.push(`CONDIÇÕES CLIMÁTICAS:\n${input.weather}`);
  }
  if (input.chunks.length > 0) {
    const context = input.chunks
      .map((c) => `[Fonte: ${c.title} | Página ${c.page ?? "?"}]\n${c.content}`)
      .join("\n\n---\n\n");
    contextBlocks.push(`CONHECIMENTO TÉCNICO:\n${context}`);
  }

  const system = contextBlocks.length > 0
    ? SYSTEM_PROMPT + "\n\n" + contextBlocks.join("\n\n")
    : SYSTEM_PROMPT;

  const messages: ChatMessage[] = [{ role: "system", content: system }];

  for (const turn of input.history ?? []) {
    const role = turn.role === "assistant" ? "assistant" : "user";
    messages.push({ role, content: turn.content });
  }

  messages.push({ role: "user", content: input.question });
  return messages;
}

export async function* streamAnswer(input: SynthesisInput): AsyncGenerator<string> {
  const messages = buildMessages(input);

  const response = await fetch(`${LLM_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: LLM_MODEL, messages, stream: true }),
  });

  if (!response.ok || !response.body) {
    throw new Error(`LLM falhou: ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const obj = JSON.parse(line) as { message?: { content?: string }; done?: boolean };
        if (obj.message?.content) yield obj.message.content;
        if (obj.done) return;
      } catch {}
    }
  }
}

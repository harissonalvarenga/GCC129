import { Chunk } from "./types";

const LLM_URL = process.env.LLM_URL || "http://llm-service:11434";
const LLM_MODEL = process.env.LLM_MODEL || "llama3.1:8b";

const SYSTEM_PROMPT =
  "Você é um agrônomo especialista em agricultura tropical e pecuária brasileira. " +
  "Responda à pergunta usando SOMENTE o conhecimento técnico fornecido abaixo. " +
  "Seja direto e prático, como um agrônomo orientando um agricultor pessoalmente. " +
  "Use etapas numeradas quando a resposta envolver procedimentos. " +
  "NÃO mencione fontes, arquivos, documentos ou que está consultando qualquer base de dados. " +
  "Se o conhecimento fornecido não cobrir a pergunta, diga apenas que não tem informação " +
  "suficiente sobre esse tema — NÃO invente dados agronômicos.";

export interface SynthesisInput {
  question: string;
  chunks: Chunk[];
  visionDiagnosis?: string;
  weather?: string;
}

function buildPrompt(input: SynthesisInput): string {
  const blocks: string[] = [SYSTEM_PROMPT];

  if (input.visionDiagnosis) {
    blocks.push(`ANÁLISE DA IMAGEM ENVIADA PELO AGRICULTOR:\n${input.visionDiagnosis}`);
  }
  if (input.weather) {
    blocks.push(`CONDIÇÕES CLIMÁTICAS:\n${input.weather}`);
  }
  if (input.chunks.length > 0) {
    const context = input.chunks
      .map((c) => `[Fonte: ${c.title} | Página ${c.page ?? "?"}]\n${c.content}`)
      .join("\n\n---\n\n");
    blocks.push(`CONHECIMENTO TÉCNICO:\n${context}`);
  }
  blocks.push(`PERGUNTA DO AGRICULTOR:\n${input.question}`);
  blocks.push("RESPOSTA:");
  return blocks.join("\n\n");
}

// Streams tokens from Ollama as they are generated.
export async function* streamAnswer(input: SynthesisInput): AsyncGenerator<string> {
  const prompt = buildPrompt(input);

  const response = await fetch(`${LLM_URL}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: LLM_MODEL, prompt, stream: true }),
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
        const obj = JSON.parse(line) as { response?: string; done?: boolean };
        if (obj.response) yield obj.response;
        if (obj.done) return;
      } catch {}
    }
  }
}

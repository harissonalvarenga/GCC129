// Modelo de visão e endpoint do Ollama configuráveis por env var.
// Decidir o modelo na hora de rodar (ex: "llama3.2-vision" ou "llava").
const LLM_URL = process.env.LLM_URL || "http://llm-service:11434";
const VISION_MODEL = process.env.VISION_MODEL || "llama3.2-vision";

// Apenas DESCRIÇÃO visual (sem "diagnostique"): evita a recusa do llava.
// O diagnóstico/tratamento fica com o llama3.1 + manuais no orquestrador.
const DIAGNOSIS_PROMPT =
  "Descreva em português, de forma objetiva, APENAS o que está visível nesta foto " +
  "de uma planta, para fins de análise agronômica: cor das folhas; presença, cor, " +
  "formato e distribuição de manchas; furos, lesões, murchamento ou insetos visíveis. " +
  "Liste somente o que você observa na imagem, sem dar conselhos nem recusar.";

export interface VisionResult {
  diagnosis: string;
}

export async function analyzeImage(
  imageBuffer: Buffer
): Promise<VisionResult> {

  // Ollama aceita imagens em base64 no campo "images" do /api/generate.
  const base64Image = imageBuffer.toString("base64");

  const response = await fetch(`${LLM_URL}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: VISION_MODEL,
      prompt: DIAGNOSIS_PROMPT,
      images: [base64Image],
      stream: false
    })
  });

  if (!response.ok) {
    throw new Error(
      `Vision LLM falhou: ${response.status}`
    );
  }

  const data = await response.json() as { response: string };

  return { diagnosis: data.response.trim() };
}

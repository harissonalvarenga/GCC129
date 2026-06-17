import sharp from "sharp";

const LLM_URL = process.env.LLM_URL || "http://llm-service:11434";
const VISION_MODEL = process.env.VISION_MODEL || "llama3.2-vision";

// Apenas DESCRIÇÃO visual (sem "diagnostique"): evita a recusa do llava.
// O diagnóstico/tratamento fica com o llama3.1 + manuais no orquestrador.
const DIAGNOSIS_PROMPT =
  "Describe this photo for agronomic analysis in 3-4 short sentences. " +
  "Focus on: plant/fruit condition, color changes, spots, fungal growth, mold, rot, " +
  "lesions, holes, wilting, deformities, or visible insects/pests. " +
  "Be specific about abnormalities — note their color, pattern, and location on the plant. " +
  "Only describe what you see — no advice.";

export interface VisionResult {
  diagnosis: string;
}

export async function analyzeImage(
  imageBuffer: Buffer
): Promise<VisionResult> {

  // Normalise any format (WebP, AVIF, etc.) to JPEG so CLIP can parse it.
  const jpeg = await sharp(imageBuffer).jpeg({ quality: 90 }).toBuffer();
  const base64Image = jpeg.toString("base64");

  const response = await fetch(`${LLM_URL}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: VISION_MODEL,
      prompt: DIAGNOSIS_PROMPT,
      images: [base64Image],
      stream: false,
      options: { temperature: 0.2 },
    })
  });

  if (!response.ok) {
    const body = await response.text();
    console.error("Ollama error body:", body);
    throw new Error(
      `Vision LLM falhou: ${response.status} — ${body}`
    );
  }

  const data = await response.json() as { response: string };

  return { diagnosis: data.response.trim() };
}

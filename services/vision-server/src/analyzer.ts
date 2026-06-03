export interface VisionResult {
  tags: string[];
  confidence: number;
}

export async function analyzeImage(
  imageBuffer: Buffer
): Promise<VisionResult> {

  // Mock para demonstração

  return {
    tags: [
      "folha",
      "mancha escura",
      "possível fungo"
    ],
    confidence: 0.87
  };
}
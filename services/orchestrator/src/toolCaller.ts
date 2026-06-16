import axios from "axios";
import FormData from "form-data";

import { Chunk } from "./types";

// Resolução de nomes do Docker dentro da agro-network.
const VISION_URL = "http://vision-service:8004";
const RAG_URL = "http://rag-service:8001";

// Visão: envia a imagem e recebe um diagnóstico textual (vira contexto pro LLM).
export async function callVisionService(
  imageBuffer: Buffer
): Promise<string> {

  const form = new FormData();
  form.append("image", imageBuffer, "image.jpg");

  const response = await axios.post(
    `${VISION_URL}/analyze`,
    form,
    { headers: form.getHeaders() }
  );

  return response.data.diagnosis as string;
}

// RAG: retriever puro — devolve os chunks mais relevantes (sem gerar resposta).
export async function callRagService(
  query: string,
  k = 5
): Promise<Chunk[]> {

  const response = await axios.post(
    `${RAG_URL}/search`,
    { query, k },
    { headers: { "Content-Type": "application/json" } }
  );

  return response.data as Chunk[];
}

export type Intent =
  | "vision"
  | "weather"
  | "rag";

// Chunk recuperado pelo rag-service (retriever puro, Padrão B).
export interface Chunk {
  title: string;
  content: string;
  page: number | null;
  distance: number;
}

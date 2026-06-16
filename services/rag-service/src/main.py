import os
from contextlib import asynccontextmanager

import numpy as np
import psycopg
from fastapi import FastAPI
from langchain_huggingface import HuggingFaceEmbeddings
from pgvector.psycopg import register_vector
from pydantic import BaseModel
from sentence_transformers import CrossEncoder

# --- Configuração via ambiente (com defaults para a rede agro-network) ---
DB_URI = os.getenv(
    "RAG_DB_URI",
    "postgresql://rag_user:rag_password@rag-db:5432/rag_database",
)
EMBED_MODEL = "intfloat/multilingual-e5-large"  # 1024 dims — schema VECTOR(1024)
RERANK_MODEL = "BAAI/bge-reranker-v2-m3"        # multilingual cross-encoder

# Quantos candidatos buscar por vaga a retornar (busca vetorial ampla → reranker).
# k=5 → 20 candidatos; o reranker escolhe os 5 mais relevantes pela query.
RERANK_FACTOR = 4

# Padrão B: este serviço APENAS recupera (embed + busca vetorial + reranking).
# A montagem do prompt e a chamada ao llama3 ficam no orquestrador,
# que junta os contextos (RAG + visão + clima) numa única síntese.
# Embedding e reranker rodam na CPU para liberar a VRAM da RTX 5060 ao llama3.
embeddings_model: HuggingFaceEmbeddings
reranker: CrossEncoder
db_conn: psycopg.Connection


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Carrega modelos e abre a conexão UMA vez no boot (não por request)."""
    global embeddings_model, reranker, db_conn

    print(f"Carregando modelo de embedding '{EMBED_MODEL}' na CPU...")
    embeddings_model = HuggingFaceEmbeddings(
        model_name=EMBED_MODEL,
        model_kwargs={"device": "cpu"},
        encode_kwargs={"normalize_embeddings": True},
    )

    print(f"Carregando reranker '{RERANK_MODEL}' na CPU...")
    reranker = CrossEncoder(RERANK_MODEL, max_length=512)

    print(f"Conectando ao banco vetorial: {DB_URI.split('@')[-1]}")
    db_conn = psycopg.connect(DB_URI, autocommit=True)
    register_vector(db_conn)

    print("rag-service pronto.")
    yield

    db_conn.close()


app = FastAPI(title="agro-rag-service", lifespan=lifespan)


class SearchRequest(BaseModel):
    query: str
    k: int = 5  # chunks devolvidos após reranking


class Chunk(BaseModel):
    title: str
    content: str
    page: int | None = None
    distance: float
    rerank_score: float | None = None


@app.post("/search", response_model=list[Chunk])
async def search(req: SearchRequest):
    """Busca vetorial ampla (k × RERANK_FACTOR) + reranking cross-encoder.

    1. Embeda a query com o prefixo "query: " (protocolo E5).
    2. Busca os top-k*RERANK_FACTOR chunks por distância L2 (ANN via HNSW).
    3. Reranker cross-encoder pontua (query, chunk) com relevância semântica fina.
    4. Retorna os k melhores pelo score do reranker.
    """
    fetch_k = max(req.k * RERANK_FACTOR, 20)  # nunca busca menos de 20

    query_vector = np.array(
        embeddings_model.embed_query(f"query: {req.query}"), dtype=np.float32
    )

    with db_conn.cursor() as cur:
        cur.execute(
            """
            SELECT title, content, metadata, embedding <-> %s AS distance
            FROM embrapa_documents
            ORDER BY embedding <-> %s
            LIMIT %s
            """,
            (query_vector, query_vector, fetch_k),
        )
        rows = cur.fetchall()

    if not rows:
        return []

    # Reranking: cross-encoder pontua cada (query, passage) independentemente.
    # Scores são logits não normalizados — maior = mais relevante.
    pairs = [(req.query, row[1]) for row in rows]
    scores = reranker.predict(pairs)

    ranked = sorted(
        zip(rows, scores),
        key=lambda x: x[1],
        reverse=True,
    )[:req.k]

    return [
        Chunk(
            title=row[0],
            content=row[1],
            page=row[2].get("page"),
            distance=round(float(row[3]), 4),
            rerank_score=round(float(score), 4),
        )
        for row, score in ranked
    ]


@app.get("/health")
async def health():
    return {"status": "ok"}

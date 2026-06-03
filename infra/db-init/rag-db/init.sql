CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS embrapa_documents (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255),
    content TEXT NOT NULL,
    metadata JSONB,
    embedding VECTOR(768)
);

CREATE INDEX ON embrapa_documents USING hnsw (embedding vector_l2_ops);
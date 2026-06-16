FROM python:3.11-slim

WORKDIR /app

# torch CPU-only ANTES dos requirements: evita baixar ~2.5GB de libs CUDA
# (o embedding roda na CPU; a GPU fica reservada ao llama3 no llm-service).
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Baixa modelos no build (cache em camada) para o primeiro request ser rápido.
RUN python -c "from sentence_transformers import SentenceTransformer; \
    SentenceTransformer('intfloat/multilingual-e5-large')"
RUN python -c "from sentence_transformers import CrossEncoder; \
    CrossEncoder('BAAI/bge-reranker-v2-m3')"

COPY src/ ./src/

EXPOSE 8001

CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8001"]

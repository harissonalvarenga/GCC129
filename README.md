# Agro Assistente

Sistema distribuído de suporte à decisão para **manejo inteligente de culturas agrícolas**, desenvolvido para a disciplina **GCC129 — Sistemas Distribuídos** (UFLA — Universidade Federal de Lavras).

Combina recuperação semântica de documentos técnicos (RAG), análise de imagens por visão computacional, dados agroclimáticos em tempo real (MCP) e geração de linguagem natural (LLM) para apoiar produtores rurais, técnicos agrícolas e agrônomos em decisões de manejo fitossanitário.

---

## O Problema

O Brasil é o maior consumidor de defensivos agrícolas do mundo (R$ 57 bilhões em 2023). Parte expressiva desse gasto é desperdiçada por:

- Identificação imprecisa de doenças e pragas sem acesso rápido aos manuais técnicos da Embrapa
- Aplicação fora da janela climática correta (antes de chuvas, em dias de vento forte, com solo saturado)
- Tempo de resposta lento — uma consulta manual pode demorar horas enquanto pragas se alastram
- Dificuldade em interpretar sintomas visuais sem um agrônomo presente em campo

---

## A Solução

O agricultor interage via chat (texto, foto, ou ambos). O sistema executa três pipelines conforme a intenção detectada:

1. **RAG (texto):** recupera os trechos mais relevantes de manuais Embrapa via busca vetorial (pgvector + E5-large) com reranking por cross-encoder (BGE-reranker-v2-m3)
2. **Visão (foto):** um modelo multimodal (LLaVA) descreve os sintomas visíveis na imagem; a descrição alimenta o RAG e a síntese
3. **Clima (MCP):** dados agroclimáticos de 3 dias via Open-Meteo — temperatura, ET₀, umidade do solo, déficit de pressão de vapor (VPD), probabilidade de chuva
4. **Síntese (LLM):** o Llama 3.1 combina todos os contextos (RAG + visão + clima) numa resposta prática em português

As três fontes de contexto se combinam livremente: uma pergunta com foto sobre o clima ativa visão + clima + RAG numa única resposta.

---

## Arquitetura

Todos os serviços rodam localmente via Docker Compose, com a GPU dedicada à inferência LLM.

```text
                      ┌────────────────┐
                      │   Frontend     │ :3000
                      │  (nginx + JS)  │
                      └───────┬────────┘
                              │ WebSocket
                      ┌───────▼────────┐
                      │    Gateway     │ :8080
                      │   (WS → HTTP)  │
                      └───────┬────────┘
                              │ NDJSON streaming
                      ┌───────▼────────┐
                      │  Orquestrador  │ :8000
                      │  (Node.js)     │
                      └──┬──────┬──────┘
           ┌─────────────┼──────┼─────────────┐
           │             │      │             │
    ┌──────▼──────┐ ┌────▼───┐ ┌▼──────────┐ ┌▼──────────┐
    │ RAG Service │ │ Vision │ │ MCP Server │ │ Ollama    │
    │ (FastAPI)   │ │ Server │ │ (clima)    │ │ (LLM+GPU) │
    │ :8001       │ │ :8004  │ │ :3001      │ │ :11434    │
    └──────┬──────┘ └────┬───┘ └──────┬─────┘ └───────────┘
           │             │            │
    ┌──────▼──────┐      │     ┌──────▼──────────┐
    │  pgvector   │      │     │  Open-Meteo API │
    │ (PostgreSQL)│      │     │  (geocoding +   │
    │ :5432       │      │     │   forecast)     │
    └─────────────┘      │     └─────────────────┘
                         │
                    ┌────▼────┐
                    │  LLaVA  │
                    │ (Ollama)│
                    └─────────┘
```

### Fluxo de uma consulta com imagem + clima

```text
Agricultor: [foto do milho] "O clima em Lavras afetou minha plantação?"
  │
  ├─ 1. Gateway repassa via HTTP ao Orquestrador
  ├─ 2. Classificador detecta intent = "vision" + weather keywords
  ├─ 3. Vision Server: LLaVA descreve sintomas → "fungal growth, mold, rot..."
  ├─ 4. MCP Server: Open-Meteo → previsão 3 dias (ET₀, VPD, solo)
  ├─ 5. Descrição visual alimenta o RAG → chunks relevantes da Embrapa
  ├─ 6. Llama 3.1 sintetiza: chunks + clima + observação visual → resposta
  └─ 7. Tokens streamados via NDJSON → WebSocket → frontend
```

### Propriedades de Sistemas Distribuídos atendidas

| Propriedade | Como é atendida |
| --- | --- |
| Transparência de Localização | Serviços se comunicam por nomes DNS do Docker (`rag-service`, `llm-service`) sem conhecer IPs |
| Transparência de Acesso | Gateway traduz WebSocket <-> HTTP/NDJSON; frontend desconhece a topologia interna |
| Tolerância a Falhas | Weather degrada graciosamente (erro de geocoding não bloqueia RAG); Vision faz fallback de query; intent híbrido (visão + clima) responde com o que estiver disponível |
| Desacoplamento | MCP Server expõe ferramentas via protocolo MCP padrão (SSE); RAG é um retriever puro; síntese fica isolada no orquestrador |
| Escalabilidade | Orquestrador stateless; RAG e Vision são serviços independentes replicáveis |

---

## Stack Tecnológica

| Camada | Tecnologia |
| --- | --- |
| Frontend | HTML/JS vanilla + WebSocket (nginx) |
| Gateway | Node.js + `ws` (WebSocket -> HTTP bridge) |
| Orquestrador | Node.js + Express (classificação, síntese, streaming NDJSON) |
| RAG Service | Python + FastAPI + pgvector + sentence-transformers |
| Embeddings | `intfloat/multilingual-e5-large` (1024 dims, CPU) |
| Reranker | `BAAI/bge-reranker-v2-m3` (cross-encoder, CPU) |
| Vector Store | PostgreSQL 16 + pgvector (HNSW index) |
| Vision | Node.js + sharp (normalização de imagem) + LLaVA (Ollama) |
| MCP Server | Node.js + `@modelcontextprotocol/sdk` + Express (SSE) |
| Clima | Open-Meteo Forecast API (sem chave de API) |
| LLM | Ollama — Llama 3.1 8B (síntese) + LLaVA (visão) |
| Containerização | Docker Compose com rede bridge isolada |

---

## Contrato da API

### Gateway — `ws://localhost:8080` (WebSocket)

O frontend abre uma conexão WebSocket. Cada mensagem é um JSON:

```jsonc
// Envio (cliente -> servidor)
{
  "message": "O clima em Lavras afetou meu milho?",
  "imageBase64": "..." // opcional — base64 da foto
}
```

A resposta é um fluxo NDJSON (uma linha JSON por mensagem WebSocket):

```jsonc
// Linha 1: metadados (intent, clima, fontes)
{ "type": "meta", "intent": "vision", "weather": "Lavras (MG) — Previsão...", "sources": [...] }

// Linhas 2..N: tokens gerados pelo LLM
{ "type": "token", "content": "Com base na" }
{ "type": "token", "content": " observação visual" }

// Última linha: fim do stream
{ "type": "done" }
```

### Orquestrador — `POST /chat` (NDJSON)

```jsonc
// Request (multipart/form-data ou JSON)
{
  "message": "Ferrugem asiática na soja",
  "imageBase64": "..."  // opcional
}

// Response: stream NDJSON (mesmo formato do WebSocket acima)
```

### RAG Service — `POST /search`

```jsonc
// Request
{ "query": "ferrugem asiática soja", "k": 5 }

// Response
[
  {
    "title": "Manual de Pragas da Soja",
    "content": "A ferrugem asiática (Phakopsora pachyrhizi)...",
    "page": 42,
    "distance": 0.3821,
    "rerank_score": 0.9914
  }
]
```

### Vision Service — `POST /analyze` (multipart)

```jsonc
// Request: form-data com campo "image" (arquivo)

// Response
{ "diagnosis": "The image shows corn ears with visible mold growth and fungal infection..." }
```

### MCP Server — SSE + tool call

O orquestrador conecta via `GET /sse` (protocolo MCP). A ferramenta `get_weather` retorna previsão agroclimática de 3 dias:

```text
Lavras (Minas Gerais) — Previsão agroclimática
Agora: 21.2°C (sensação 20.8°C), parcialmente nublado, umidade 80%, vento 5.4 km/h
Hoje: mín 11.2°C / máx 20.5°C, chuva 0.0mm (prob. 0%), ET₀ 2.35mm
Solo: umidade 0.287 m³/m³, déficit de pressão de vapor 0.42 kPa
Amanhã: 12.1–22.3°C, chuva 0.0mm (prob. 5%)
Depois de amanhã: 13.5–24.1°C, chuva 2.1mm (prob. 35%)
```

---

## Como Executar

### Pré-requisitos

- Docker + Docker Compose
- GPU NVIDIA com drivers instalados + NVIDIA Container Toolkit
- ~8 GB de VRAM (para Llama 3.1 8B + LLaVA)

### 1. Configuração

```bash
cd infra
cp .env.example .env
```

### 2. Subir os serviços

```bash
docker compose up --build
```

Na primeira execução, o Ollama precisa baixar os modelos:

```bash
docker exec -it llm_service ollama pull llama3.1:8b
docker exec -it llm_service ollama pull llava
```

### 3. Ingerir documentos no pgvector

Coloque os PDFs dos manuais Embrapa em `docs/` e execute o script de ingestão:

```bash
docker compose exec rag-service python -m scripts.ingest_docs
```

### 4. Acessar

Abra `http://localhost:3000` no navegador.

---

## Estrutura do Projeto

```text
GCC129/
├── infra/
│   ├── docker-compose.yml        # Orquestração de todos os serviços
│   ├── db-init/
│   │   ├── rag-db/init.sql       # Schema pgvector (HNSW index)
│   │   └── vision-db/init.sql
│   └── .env.example
│
├── services/
│   ├── frontend/html/
│   │   └── index.html            # Chat UI (vanilla JS + WebSocket)
│   │
│   ├── gateway/                  # WebSocket -> HTTP bridge
│   │   └── src/index.ts
│   │
│   ├── orchestrator/             # Cérebro do sistema
│   │   └── src/
│   │       ├── main.ts           # Roteamento por intent (vision/weather/rag)
│   │       ├── agent.ts          # Classificador de intenção
│   │       ├── synthesis.ts      # Prompt engineering + streaming LLM
│   │       ├── mcpClient.ts      # Cliente MCP (SSE) para clima
│   │       └── toolCaller.ts     # Clientes HTTP para RAG e Vision
│   │
│   ├── rag-service/              # Retriever puro (sem geração)
│   │   └── src/main.py           # Embed (E5) + pgvector + reranker (BGE)
│   │
│   ├── vision-server/            # Análise de imagens
│   │   └── src/analyzer.ts       # sharp (normalização) + LLaVA (Ollama)
│   │
│   └── mcp-server/               # Dados agroclimáticos
│       └── src/index.ts          # Open-Meteo geocoding + forecast
│
└── docs/                         # PDFs dos manuais Embrapa (não versionados)
```

---

## Equipe

Projeto acadêmico — GCC129 Sistemas Distribuídos
**Professor:** Andre de Lima Salgado
**Instituição:** UFLA — Universidade Federal de Lavras

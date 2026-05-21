\# Arquitetura de Sistema Inteligente Distribuído para Agricultura 🌾💻



Este repositório contém o projeto de arquitetura desenvolvido para a disciplina \*\*GCC129 - Sistemas Distribuídos\*\* (UFLA 2026/1). O sistema utiliza uma abordagem de microsserviços para integrar Large Language Models (LLMs) com bases de conhecimento técnicas e ferramentas externas.



\## 🚀 Visão Geral da Arquitetura



O projeto foi desenhado sob os princípios de \*\*transparência, escalabilidade e modularidade\*\*. A solução proposta não é um monólito, mas um ecossistema distribuído que orquestra diferentes fluxos de informação:



1\.  \*\*Conhecimento Estático (RAG):\*\* Recuperação de manuais técnicos e diretrizes acadêmicas.

2\.  \*\*Dados Dinâmicos (MCP):\*\* Integração via protocolo padronizado com APIs de clima e solo.

3\.  \*\*Processamento Visual:\*\* Identificação multimodal de patologias em culturas.



\## 🏗️ Componentes Distribuídos



\### 1. API Gateway

Atua como ponto de entrada único (Ingress), gerenciando:

\- Roteamento de requisições para microsserviços internos.

\- Autenticação e autorização (JWT).

\- Agregação de logs e métricas.



\### 2. LLM Orchestrator

O núcleo inteligente do sistema, responsável por:

\- Classificação de intenção do usuário.

\- Orquestração de chamadas entre o serviço RAG e os servidores MCP.

\- Síntese de resposta contextualizada.



\### 3. RAG Service (Retrieval-Augmented Generation)

Microsserviço de conhecimento profundo:

\- \*\*Base Vetorial:\*\* ChromaDB.

\- \*\*Processamento:\*\* Embeddings de manuais técnicos para garantir respostas baseadas em evidências científicas.



\### 4. MCP Servers (Model Context Protocol)

Implementação de servidores MCP para ferramentas externas:

\- \*\*Weather Tool:\*\* Integração em tempo real com APIs meteorológicas.

\- \*\*Protocolo:\*\* JSON-RPC 2.0 sobre transporte STDIO/SSE.



\## 🛠️ Stack Tecnológica

\- \*\*Backend:\*\* Python 3.11+ / FastAPI

\- \*\*IA/LLM:\*\* LangChain \& MCP SDK

\- \*\*Banco Vetorial:\*\* ChromaDB

\- \*\*Infraestrutura:\*\* Docker \& Docker Compose

\- \*\*Protocolos de Comunicação:\*\* REST (externo) e JSON-RPC (ferramentas MCP)



\## 📋 Requisitos de Sistemas Distribuídos Atendidos

\- \*\*Arquitetura em Microsserviços:\*\* Separação clara de responsabilidades e deploy independente.

\- \*\*Integração de Ferramentas Externas:\*\* Uso de MCP para acesso a sistemas legados ou externos.

\- \*\*Recuperação de Informação:\*\* Pipeline de RAG para suporte à tomada de decisão.

\- \*\*Protocolos Padronizados:\*\* Uso de REST e JSON-RPC para interoperabilidade.


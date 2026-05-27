# DocuMind AI

A production-grade RAG (Retrieval-Augmented Generation) backend platform that lets users upload documents, automatically processes them into searchable vector embeddings, and enables natural-language Q&A conversations with cited, source-grounded answers.

Built with NestJS, PostgreSQL/pgvector, BullMQ, and MinIO. It is designed to demonstrate async document processing pipelines, vector similarity search, and LLM integration in a real-world backend architecture.

---

## The Problem

Knowledge workers spend 20–30% of their time searching through documents. Keyword search misses semantic meaning, and generic AI chatbots lack access to private documents. DocuMind AI solves this by letting users ask natural language questions against their own uploaded documents and receive accurate, cited answers, not generic internet results.

---

## Key Features

**Document Ingestion Pipeline** — Upload PDFs, DOCX, or TXT files. The system automatically extracts text, splits it into semantically coherent chunks with configurable overlap, generates vector embeddings, and stores everything in pgvector. All processing happens asynchronously via BullMQ so uploads return instantly.

**RAG-Powered Q&A** — Ask questions in plain English. The system embeds your question, runs a cosine similarity search against your document chunks using an HNSW index, assembles the most relevant excerpts into a prompt, and generates a grounded answer with source citations (document name, page reference, similarity score).

**Conversation History** — Follow-up questions carry context. The system injects the last 10 messages into each prompt so the LLM understands conversational continuity without re-explaining.

**Collection-Based Organization** — Group documents into collections by project or topic. Conversations are scoped to collections, so queries only search relevant documents.

**Duplicate Detection** — SHA-256 checksums prevent the same file from being uploaded twice to the same collection.

**Citation Transparency** — Every AI response includes structured citation metadata: which chunks were used, from which document, with what similarity score. Nothing is a black box.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Client (Postman / Frontend)          │
└──────────────────────────┬──────────────────────────────┘
                           │
                    ┌──────▼──────┐
                    │  NestJS API │
                    │  (REST)     │
                    └──────┬──────┘
                           │
          ┌────────────────┼────────────────┐
          │                │                │
   ┌──────▼──────┐   ┌─────▼─────┐   ┌──────▼──────┐
   │ Auth Module  │  │ Document  │   │Conversation │
   │(JWT/Passport)│  │ Module    │   │ Module      │
   └─────────────┘   └─────┬─────┘   └──────┬──────┘
                           │                │
                    ┌──────▼──────┐         │
                    │   BullMQ    │         │
                    │  (Redis)    │         │
                    └──────┬──────┘         │
                           │                │
                    ┌──────▼──────┐         │
                    │  Document   │         │
                    │  Processing │         │
                    │  Consumer   │         │
                    └──────┬──────┘         │
                           │                │
        ┌──────────────────┼────────────────┤
        │                  │                │
 ┌──────▼──────┐    ┌──────▼──────┐  ┌──────▼──────┐
 │   MinIO     │    │ PostgreSQL  │  │   Ollama    │
 │ (S3 Storage)│    │ + pgvector  │  │(Embeddings  │
 └─────────────┘    └─────────────┘  │   + LLM)    │
                                     └─────────────┘
```

### Ingestion Flow

1. User uploads a file → validated (type, size, duplicate check, 50-doc limit)
2. File stored in MinIO with a unique S3 key
3. BullMQ job queued with `documentId` and `s3key`
4. Consumer processes asynchronously:
   - Downloads file buffer from MinIO
   - Extracts text (pdf-parse for PDFs, mammoth for DOCX)
   - Chunks text using recursive character splitting (512 tokens, 50-token overlap)
   - Generates 768-dimensional embeddings via Ollama (nomic-embed-text)
   - Stores chunks + vectors in pgvector inside a database transaction
   - Updates document status to `COMPLETED`
5. On failure after 3 retries, document is cleaned up from DB and MinIO bucket

### Query Flow

1. User sends a question scoped to a collection
2. Question is embedded using the same embedding model
3. pgvector cosine similarity search finds top-5 relevant chunks (above 0.3 threshold)
4. Context assembly: system prompt + document excerpts with source metadata + conversation history + current question
5. LLM generates a grounded, cited answer
6. User message, assistant response, and citation metadata are stored

---

## Tech Stack

| Component        | Technology                          | Purpose                                    |
|------------------|-------------------------------------|--------------------------------------------|
| Framework        | NestJS + TypeScript                 | Type-safe backend with modular architecture|
| Database         | PostgreSQL 16 + pgvector            | Relational data + vector similarity search |
| ORM              | Prisma                              | Schema management, migrations, type-safe queries |
| Queue            | BullMQ + Redis                      | Async document processing with retries     |
| Object Storage   | MinIO                               | S3-compatible file storage                 |
| Embeddings       | Ollama (nomic-embed-text)           | 768-dim vector generation                  |
| LLM              | Ollama (llama3.2)                   | Answer generation with citations           |
| Auth             | Passport.js + JWT                   | Access/refresh token authentication        |
| Text Extraction  | pdf-parse, mammoth                  | PDF and DOCX to plain text                 |
| Chunking         | LangChain RecursiveCharacterTextSplitter | Semantic text splitting              |
| Containerization | Docker Compose                      | Full local environment                     |

---

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm
- Docker and Docker Compose

### Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/yourusername/documind-ai.git
   cd documind-ai
   ```

2. **Install dependencies:**
   ```bash
   pnpm install
   ```

3. **Configure environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your values (see Environment Variables section)
   ```

4. **Start infrastructure services:**
   ```bash
   docker-compose up -d
   ```

5. **Pull Ollama models:**
   ```bash
   docker exec -it ollama ollama pull nomic-embed-text
   docker exec -it ollama ollama pull llama3.2
   ```

6. **Run database migrations:**
   ```bash
   pnpx prisma migrate dev
   pnpx prisma generate
   ```

7. **Start the application:**
   ```bash
   pnpm run start:dev
   ```

The API will be available at `http://localhost:3000`.

### Environment Variables

```env
# Database
DATABASE_URL=postgresql://postgres:yourpassword@localhost:5433/docker_documind_db
POSTGRES_USER=postgres
POSTGRES_PASSWORD=yourpassword
POSTGRES_DB=docker_documind_db

# MinIO
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=minioadmin
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_BUCKET_NAME=documents

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Ollama
OLLAMA_URL=http://localhost:11434

# JWT
JWT_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-secret
JWT_EXPIRATION=15m
JWT_REFRESH_EXPIRATION=7d
```

---

## API Endpoints

### Authentication
| Method | Endpoint          | Description              |
|--------|-------------------|--------------------------|
| POST   | `/users/create`   | Register a new user      |
| POST   | `/auth/login`     | Login (returns JWT pair)  |
| POST   | `/auth/refresh`   | Refresh access token      |
| POST   | `/auth/logout`    | Invalidate refresh token  |
| GET    | `/users/profile`  | Get current user profile  |

### Documents
| Method | Endpoint                     | Description                        |
|--------|------------------------------|------------------------------------|
| POST   | `/document/upload`           | Upload a document (PDF/DOCX/TXT)   |
| GET    | `/document/list`             | List documents (optional `?collectionId=`) |
| GET    | `/document/:id/download-url` | Get presigned download URL         |
| DELETE | `/document/:id`              | Delete a document                  |
| DELETE | `/document/delete/many`      | Batch delete documents             |

### Conversations
| Method | Endpoint                              | Description                              |
|--------|---------------------------------------|------------------------------------------|
| POST   | `/conversation/:collectionId`         | Start conversation with first question   |
| POST   | `/conversation/:conversationId/message` | Send follow-up question                |
| GET    | `/conversation/all`                   | List conversations (optional `?collectionId=`) |
| GET    | `/conversation/:id`                   | Get conversation with message history    |
| DELETE | `/conversation/:id`                   | Soft delete a conversation               |

---

## Design Decisions

**Why pgvector over Pinecone/Weaviate?** — pgvector adds vector search to PostgreSQL without introducing a separate database. It keeps the operational footprint small and demonstrates extending existing tools rather than stacking buzzwords.

**Why BullMQ over Kafka?** — Kafka is designed for cross-service event streaming at massive scale. BullMQ provides reliable job queues with retries, backoff, and delay using Redis — the right tool for a single-application processing pipeline.

**Why a single processing job instead of chained jobs?** — The pipeline steps (download → extract → chunk → embed → store) are strictly sequential and tightly coupled. Splitting them into separate jobs adds coordination complexity without benefit at this scale. Each step is a separate service method for future refactoring if needed.

**Why raw SQL for vector operations?** — Prisma's `Unsupported` type cannot be written to through the normal API. All chunk inserts use `$executeRaw` with `::vector` casts, and similarity searches use `$queryRawUnsafe` with pgvector's `<=>` cosine distance operator.

**Why Ollama for local development?** — Zero API costs during development. The embedding service and LLM service are abstracted behind interfaces, making it trivial to swap to OpenAI or Google Gemini for production by changing one import.

---

## Project Structure

```
src/
├── auth/                  # JWT authentication (Passport.js)
├── conversation/          # Q&A endpoints + RAG pipeline
│   ├── services/
│   │   ├── vector-search.service.ts      # pgvector similarity queries
│   │   ├── context-assembly.service.ts   # Prompt construction
│   │   └── ollama-llm.service.ts         # LLM answer generation
│   ├── conversation.controller.ts
│   └── conversation.service.ts
├── document/              # Upload, processing, CRUD
│   ├── consumers/
│   │   └── document-processing.consumer.ts  # BullMQ worker
│   ├── services/
│   │   ├── text-extraction.service.ts    # PDF/DOCX/TXT extraction
│   │   ├── chunking.service.ts           # Recursive text splitting
│   │   └── ollama-embedding.service.ts   # Vector embedding generation
│   ├── document.controller.ts
│   └── document.service.ts
├── minio/                 # S3-compatible storage service
├── prisma/                # Database client + raw SQL methods
├── queue/                 # BullMQ configuration module
└── users/                 # User management
```

---

## Performance Characteristics

Measured with a 20-page PDF (32K characters, 77 chunks):

| Operation                    | Duration    |
|------------------------------|-------------|
| File upload + MinIO storage  | ~1–2s       |
| Text extraction              | ~2s         |
| Chunking (77 pieces)         | <1s         |
| Embedding generation (Ollama)| ~30–40s     |
| Vector storage (transaction) | ~1s         |
| Query embedding              | ~1s         |
| Vector similarity search     | <1s         |
| LLM answer generation        | 100–200s*   |

*LLM inference runs on CPU via Docker. Production deployment with a cloud LLM API (Gemini Flash, GPT-4o-mini) reduces this to 2–5 seconds.

---

## License

MIT

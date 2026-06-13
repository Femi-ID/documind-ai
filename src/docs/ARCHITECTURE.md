# Architecture

This document explains how DocuMind AI is structured at runtime, what data flows through each component, and why specific design decisions were made.

## High-level architecture

```mermaid
graph TB
    Client[Client Application]

    subgraph "API Layer (NestJS)"
        Gateway[API Gateway<br/>v1 + Swagger]
        Auth[Auth Module<br/>JWT + Refresh]
        Doc[Document Module]
        Conv[Conversation Module]
        Coll[Collections Module]
        Sys[System<br/>Health + Metrics]
    end

    subgraph "Async Processing"
        Queue[BullMQ Queue<br/>document-processing]
        Worker[Worker Consumer<br/>3 retries + backoff]
    end

    subgraph "RAG Pipeline"
        Extract[Text Extraction<br/>pdf-parse / mammoth]
        Chunk[Chunking<br/>512 tokens / 50 overlap]
        Embed[Embedding<br/>Ollama nomic-embed-text]
        Search[Vector Search<br/>pgvector + HNSW]
        Context[Context Assembly<br/>+ conversation history]
        LLM[LLM Generation<br/>Ollama llama3.2]
    end

    subgraph "Data Layer"
        Postgres[(PostgreSQL 16<br/>+ pgvector)]
        Redis[(Redis<br/>cache + queue)]
        MinIO[(MinIO<br/>S3-compatible)]
    end

    Client -->|HTTPS| Gateway
    Gateway --> Auth
    Gateway --> Doc
    Gateway --> Conv
    Gateway --> Coll
    Gateway --> Sys

    Doc -->|enqueue job| Queue
    Queue --> Worker
    Worker --> Extract --> Chunk --> Embed --> Postgres

    Conv -->|first message| Search
    Search --> Context --> LLM
    LLM --> Postgres

    Conv -.->|cache check| Redis
    Doc --> MinIO
    Doc --> Postgres
```

## Document ingestion flow

When a user uploads a document, the API responds immediately and processing happens asynchronously:

```mermaid
sequenceDiagram
    participant U as User
    participant API as API
    participant M as MinIO
    participant DB as PostgreSQL
    participant Q as BullMQ
    participant W as Worker
    participant O as Ollama

    U->>API: POST /document/upload (multipart)
    API->>API: Validate type, size, dedupe (SHA-256)
    API->>M: Upload file (returns s3_key)
    API->>DB: Insert document (status=PENDING)
    API->>Q: Enqueue processing job
    API-->>U: 200 OK (documentId)

    Note over W: Async processing begins

    Q->>W: Pick up job
    W->>DB: Update status=PROCESSING
    W->>M: Download file buffer
    W->>W: Extract text (pdf-parse/mammoth)
    W->>W: Chunk text (512 tokens, 50 overlap)
    W->>O: Generate embeddings (768-dim)
    O-->>W: Vector embeddings
    W->>DB: Store chunks + vectors (raw SQL)
    W->>DB: Update status=COMPLETED
    W->>Redis: Invalidate collection cache
```

## RAG query flow

When a user asks a question, the system either serves from cache or runs the full pipeline:

```mermaid
sequenceDiagram
    participant U as User
    participant API as API
    participant R as Redis
    participant O as Ollama
    participant DB as PostgreSQL

    U->>API: POST /conversation/:collectionId
    Note over API: Run sanitization + injection guard

    API->>R: Check cache (collectionId + question hash + version)

    alt Cache hit
        R-->>API: Cached answer
        API->>DB: Store user + assistant messages
        API-->>U: Answer (cached=true)
    else Cache miss
        API->>O: Generate query embedding
        O-->>API: 768-dim vector
        API->>DB: Vector search (top 5, cosine similarity)
        DB-->>API: Relevant chunks
        API->>API: Assemble system + user prompt
        API->>O: Generate answer
        O-->>API: LLM response
        API->>R: Cache answer (TTL 1h)
        API->>DB: Store user + assistant messages
        API-->>U: Answer (cached=false)
    end
```

## Cache invalidation strategy

The version-based invalidation pattern avoids expensive Redis SCAN operations:

```mermaid
graph LR
    subgraph "Initial state"
        K1["qa_cache:abc:v1:hash1<br/>Answer to Q1"]
        V1["collection_doc_version:abc = 1"]
    end

    subgraph "After new document upload"
        K1b["qa_cache:abc:v1:hash1<br/>(orphaned, expires via TTL)"]
        V2["collection_doc_version:abc = 2"]
        K2["qa_cache:abc:v2:hash1<br/>(new question generates new key)"]
    end

    V1 -.->|INCR on doc add| V2
    K1 -.->|unreachable| K1b

    style K1 fill:#E1F5EE,stroke:#0F6E56,color:#04342C
    style K1b fill:#FCEBEB,stroke:#A32D2D,color:#501313
    style K2 fill:#E1F5EE,stroke:#0F6E56,color:#04342C
```

## Module dependency graph

```mermaid
graph TD
    App[AppModule]
    Auth[AuthModule]
    Users[UsersModule]
    Doc[DocumentModule]
    Conv[ConversationModule]
    Coll[CollectionsModule]
    Queue[QueueModule]
    Cache[QueryCacheModule]
    Health[HealthModule]
    Metrics[MetricsModule]
    Prisma[PrismaModule]
    Minio[MinioModule]

    App --> Auth
    App --> Users
    App --> Doc
    App --> Conv
    App --> Coll
    App --> Health
    App --> Metrics
    App --> Queue

    Auth --> Users
    Doc --> Prisma
    Doc --> Minio
    Doc --> Queue
    Doc --> Cache
    Conv --> Prisma
    Conv --> Cache
    Conv --> Coll
    Coll --> Prisma
    Health --> Prisma
    Health --> Minio
    Metrics --> Prisma
    Metrics --> Queue
```

## Security layers

Every request passes through five layers before reaching business logic:

```mermaid
graph LR
    Req[Incoming Request]
    Helmet[Helmet<br/>Security headers]
    CORS[CORS<br/>Origin check]
    Throttle[CustomThrottlerGuard<br/>Tier-based limits]
    JWT[JwtAuthGuard<br/>Token validation]
    Sanitize[SanitizeInputInterceptor<br/>Strip HTML/null bytes]
    Injection[PromptInjectionGuard<br/>12 attack patterns]
    Validate[ValidationPipe<br/>DTO validation]
    Handler[Route Handler]

    Req --> Helmet --> CORS --> Throttle --> JWT --> Sanitize --> Injection --> Validate --> Handler

    style Req fill:#E6F1FB,stroke:#185FA5,color:#042C53
    style Handler fill:#E1F5EE,stroke:#0F6E56,color:#04342C
```

## Data model

```mermaid
erDiagram
    USER ||--o{ COLLECTION : owns
    USER ||--o{ DOCUMENT : uploads
    USER ||--o{ CONVERSATION : has
    COLLECTION ||--o{ DOCUMENT : contains
    COLLECTION ||--o{ CONVERSATION : scopes
    DOCUMENT ||--o{ CHUNK : split-into
    CONVERSATION ||--o{ MESSAGE : contains

    USER {
        uuid id PK
        string email UK
        string passwordHash
        string name
        Role role
        string refreshToken
    }
    COLLECTION {
        uuid id PK
        uuid userId FK
        string name
        string description
    }
    DOCUMENT {
        uuid id PK
        uuid userId FK
        uuid collectionId FK
        string originalFilename
        string s3Key
        string checkSum
        DocumentStatus status
        int totalChunks
        int pageCount
    }
    CHUNK {
        uuid id PK
        uuid documentId FK
        text content
        int pageNumber
        vector embedding
    }
    CONVERSATION {
        uuid id PK
        uuid userId FK
        uuid collectionId FK
        string title
        bool isActive
    }
    MESSAGE {
        uuid id PK
        uuid conversationId FK
        MessageRole role
        text content
        jsonb citations
        jsonb tokenUsage
        string model
        int latencyMs
    }
```

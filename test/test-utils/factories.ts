// Factory functions for generating test data. Using factories
// (instead of hardcoding data in each test) makes tests
// resilient — if a field is added to a model, you update the
// factory once instead of 50 test files.

import { randomUUID } from 'crypto';
// import * as bcrypt from 'bcrypt';
import * as argon2 from 'argon2';

export interface UserFixture {
  id: string;
  email: string;
  hashed_password: string;
  full_name: string;
  role: 'USER' | 'ADMIN';
}

export interface DocumentFixture {
  id: string;
  userId: string;
  collectionId: string;
  original_filename: string;
  s3_Key: string;
  checkSum: string;
  file_type: 'PDF' | 'DOCX' | 'TXT';
  file_size_bytes: number;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
}

export interface ChunkFixture {
  id: string;
  documentId: string;
  content: string;
  chunkIndex: number;
  tokenCount: number;
  startCharOffset: number;
  endCharOffset: number;
  pageNumber: number | null;
  embedding: number[]; // 768-dimension
}

/**
 * Build a user fixture with sensible defaults.
 * Override any field via the `overrides` parameter.
 */
export async function buildUser(
  overrides: Partial<UserFixture> = {},
): Promise<UserFixture> {
  //   const passwordHash = await bcrypt.hash(
  //     overrides['password'] || 'TestP@ss1',
  //     10,
  //   );
  const hashedPassword = await argon2.hash(
    overrides['password'] || 'TestP@ss1',
  );

  return {
    id: randomUUID(),
    email: `test-${randomUUID()}@example.com`,
    hashed_password: hashedPassword,
    full_name: 'Test User',
    role: 'USER',
    ...overrides,
  };
}

/**
 * Build a document fixture with a fake S3 key and checksum.
 */
export function buildDocument(
  userId: string,
  collectionId: string,
  overrides: Partial<DocumentFixture> = {},
): DocumentFixture {
  return {
    id: randomUUID(),
    userId,
    collectionId,
    original_filename: 'test-document.pdf',
    s3Key: `documents/${randomUUID()}.pdf`,
    checkSum: randomUUID().replace(/-/g, ''),
    fileType: 'PDF',
    fileSizeBytes: 102400, // 100KB
    status: 'COMPLETED',
    ...overrides,
  };
}

/**
 * Build a chunk fixture with a deterministic fake embedding.
 *
 * For tests where the actual embedding values matter (similarity
 * search tests), use buildEmbedding() with specific patterns.
 */
export function buildChunk(
  documentId: string,
  overrides: Partial<ChunkFixture> = {},
): ChunkFixture {
  const content =
    overrides.content || 'This is a test chunk of document content.';
  return {
    id: randomUUID(),
    documentId,
    content,
    chunkIndex: 0,
    tokenCount: Math.ceil(content.length / 4), // rough token estimate
    startCharOffset: 0,
    endCharOffset: content.length,
    pageNumber: 1,
    embedding: buildEmbedding(),
    ...overrides,
  };
}

/**
 * Build a fake 768-dimensional embedding.
 *
 * - buildEmbedding() → random vector
 * - buildEmbedding(0.5) → all values set to 0.5 (for similarity tests)
 * - buildEmbedding('seed-A') → deterministic from seed
 */
export function buildEmbedding(seed?: number | string): number[] {
  const dim = 768;

  if (typeof seed === 'number') {
    return Array(dim).fill(seed);
  }

  if (typeof seed === 'string') {
    // Deterministic pseudo-random based on string hash
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = (hash * 31 + seed.charCodeAt(i)) % 1000;
    }
    return Array.from({ length: dim }, (_, i) => Math.sin(hash + i) * 0.5);
  }

  return Array.from({ length: dim }, () => Math.random() * 2 - 1);
}

/**
 * Build two embeddings with known cosine similarity.
 * Useful for testing similarity thresholds.
 */
export function buildSimilarEmbeddings(
  similarity: number,
): [number[], number[]] {
  const a = buildEmbedding('vector-a');
  // Mix 'a' and a random vector to control similarity
  const b = buildEmbedding('vector-b');
  const mixed = a.map((v, i) => v * similarity + b[i] * (1 - similarity));
  return [a, mixed];
}

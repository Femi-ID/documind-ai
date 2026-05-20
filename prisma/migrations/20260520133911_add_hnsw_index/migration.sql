--Add chunk Index on CHUNK table in Embedding Column
CREATE INDEX IF NOT EXISTS chunk_embedding_idx 
ON "Chunk" 
USING hnsw ("embedding" vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
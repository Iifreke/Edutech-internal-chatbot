-- ============================================================
-- Edutech Internal Chatbot — Full Database Setup
-- Paste this entire script into the Supabase SQL Editor and click Run
-- Project: efgmrhyxhxtbvbxxdtkq (eabtconnect@gmail.com)
-- ============================================================

-- 1. pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Documents table (holds both uploaded files and scraped web sources)
CREATE TABLE IF NOT EXISTS kb_documents (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  filename     TEXT        NOT NULL,
  file_type    TEXT        NOT NULL,
  file_size    INTEGER,
  storage_path TEXT,
  chunk_count  INTEGER     DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Chunks table with 1536-dim vector column (OpenAI text-embedding-3-small)
CREATE TABLE IF NOT EXISTS kb_chunks (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID        REFERENCES kb_documents(id) ON DELETE CASCADE,
  content     TEXT        NOT NULL,
  chunk_index INTEGER     NOT NULL,
  embedding   VECTOR(1536),
  metadata    JSONB       DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 4. HNSW index for fast cosine-similarity search
CREATE INDEX IF NOT EXISTS kb_chunks_embedding_idx
  ON kb_chunks USING hnsw (embedding vector_cosine_ops);

-- 5. Vector similarity search function used by the chat API
CREATE OR REPLACE FUNCTION match_kb_chunks(
  query_embedding VECTOR(1536),
  match_threshold FLOAT DEFAULT 0.3,
  match_count     INT   DEFAULT 8
)
RETURNS TABLE (
  id          UUID,
  document_id UUID,
  content     TEXT,
  metadata    JSONB,
  similarity  FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    kb_chunks.id,
    kb_chunks.document_id,
    kb_chunks.content,
    kb_chunks.metadata,
    1 - (kb_chunks.embedding <=> query_embedding) AS similarity
  FROM kb_chunks
  WHERE 1 - (kb_chunks.embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;

-- 6. Auto-update updated_at trigger on kb_documents
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS kb_documents_updated_at ON kb_documents;
CREATE TRIGGER kb_documents_updated_at
  BEFORE UPDATE ON kb_documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 7. Row Level Security — only service role can access these tables directly
ALTER TABLE kb_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE kb_chunks    ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if re-running
DROP POLICY IF EXISTS "service_role_only" ON kb_documents;
DROP POLICY IF EXISTS "service_role_only" ON kb_chunks;

-- Block all direct anon/authenticated access (app always uses service role key)
CREATE POLICY "service_role_only" ON kb_documents FOR ALL USING (false);
CREATE POLICY "service_role_only" ON kb_chunks    FOR ALL USING (false);

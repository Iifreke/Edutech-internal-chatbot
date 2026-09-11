-- ============================================================
-- EduAssist (Edutech Global Internal AI Assistant)
-- Complete Supabase Database Setup & Schema Verification
-- ============================================================
-- Run this entire script in your Supabase SQL Editor:
-- Dashboard -> SQL Editor -> New Query -> Paste & Click "Run"
-- ============================================================

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================
-- 2. Knowledge Base Documents Table
-- ============================================================
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

-- Index for sorting and lookups
CREATE INDEX IF NOT EXISTS kb_documents_created_at_idx ON kb_documents(created_at DESC);
CREATE INDEX IF NOT EXISTS kb_documents_filename_idx ON kb_documents(filename);

-- ============================================================
-- 3. Knowledge Base Chunks Table (OpenAI text-embedding-3-small, 1536 dims)
-- ============================================================
CREATE TABLE IF NOT EXISTS kb_chunks (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID        REFERENCES kb_documents(id) ON DELETE CASCADE,
  content     TEXT        NOT NULL,
  chunk_index INTEGER     NOT NULL,
  embedding   VECTOR(1536),
  metadata    JSONB       DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Fast HNSW vector cosine similarity index
CREATE INDEX IF NOT EXISTS kb_chunks_embedding_idx
  ON kb_chunks USING hnsw (embedding vector_cosine_ops);

-- Document lookup and metadata index
CREATE INDEX IF NOT EXISTS kb_chunks_document_id_idx ON kb_chunks(document_id);
CREATE INDEX IF NOT EXISTS kb_chunks_metadata_idx ON kb_chunks USING gin (metadata);

-- ============================================================
-- 4. Leads / Contact Tracking Table
-- ============================================================
CREATE TABLE IF NOT EXISTS leads (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id       UUID,
  session_id      TEXT,
  name            TEXT,
  email           TEXT,
  phone           TEXT,
  normalized_phone TEXT,
  channel         TEXT        DEFAULT 'web',
  lead_tier       TEXT        DEFAULT 'COLD',
  lead_score      INTEGER     DEFAULT 0,
  lead_label      TEXT,
  intent_tags     JSONB       DEFAULT '[]'::jsonb,
  whatsapp_opt_in BOOLEAN     DEFAULT false,
  zoho_contact_id TEXT,
  zoho_synced_at  TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for lead lookups and sorting
CREATE INDEX IF NOT EXISTS leads_email_idx ON leads(email);
CREATE INDEX IF NOT EXISTS leads_session_id_idx ON leads(session_id);
CREATE INDEX IF NOT EXISTS leads_updated_at_idx ON leads(updated_at DESC);

-- Ensure channel check constraint allows 'web' and 'whatsapp'
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'leads_channel_check'
  ) THEN
    ALTER TABLE leads ADD CONSTRAINT leads_channel_check CHECK (channel IN ('web', 'whatsapp'));
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 5. Conversations / Search Sessions Table
-- ============================================================
CREATE TABLE IF NOT EXISTS conversations (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id          UUID,
  session_id         TEXT,
  lead_id            UUID        REFERENCES leads(id) ON DELETE CASCADE,
  stage              TEXT,
  messages           JSONB       DEFAULT '[]'::jsonb,
  failed_attempts    INTEGER     DEFAULT 0,
  rating             INTEGER,
  channel            TEXT        DEFAULT 'web',
  whatsapp_phone     TEXT,
  user_last_seen_web TIMESTAMPTZ,
  user_web_online    BOOLEAN     DEFAULT false,
  admin_typing       BOOLEAN     DEFAULT false,
  resolved_at        TIMESTAMPTZ,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for conversations
CREATE INDEX IF NOT EXISTS conversations_lead_id_idx ON conversations(lead_id);
CREATE INDEX IF NOT EXISTS conversations_session_id_idx ON conversations(session_id);
CREATE INDEX IF NOT EXISTS conversations_updated_at_idx ON conversations(updated_at DESC);

-- Ensure channel check constraint allows 'web' and 'whatsapp'
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'conversations_channel_check'
  ) THEN
    ALTER TABLE conversations ADD CONSTRAINT conversations_channel_check CHECK (channel IN ('web', 'whatsapp'));
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 6. Vector Similarity Search Function (match_kb_chunks)
-- ============================================================
CREATE OR REPLACE FUNCTION match_kb_chunks(
  query_embedding VECTOR(1536),
  match_threshold FLOAT DEFAULT 0.28,
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

-- ============================================================
-- 7. Auto-update Trigger for updated_at timestamps
-- ============================================================
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

DROP TRIGGER IF EXISTS leads_updated_at ON leads;
CREATE TRIGGER leads_updated_at
  BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS conversations_updated_at ON conversations;
CREATE TRIGGER conversations_updated_at
  BEFORE UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 8. Storage Bucket Setup (knowledgebase)
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('knowledgebase', 'knowledgebase', false)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 9. Row Level Security (RLS) Policies
-- ============================================================
-- Enable RLS on all tables
ALTER TABLE kb_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE kb_chunks    ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads        ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

-- Drop older policies if re-running
DROP POLICY IF EXISTS "service_role_all_documents" ON kb_documents;
DROP POLICY IF EXISTS "service_role_all_chunks" ON kb_chunks;
DROP POLICY IF EXISTS "service_role_all_leads" ON leads;
DROP POLICY IF EXISTS "service_role_all_conversations" ON conversations;

-- Allow full access to the service_role key (used by our Next.js backend)
CREATE POLICY "service_role_all_documents" ON kb_documents FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_chunks" ON kb_chunks FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_leads" ON leads FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_conversations" ON conversations FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Allow authenticated users to view conversations if needed
DROP POLICY IF EXISTS "authenticated_select_conversations" ON conversations;
CREATE POLICY "authenticated_select_conversations" ON conversations FOR SELECT TO authenticated USING (true);

-- ============================================================
-- 10. Storage RLS Policies (for knowledgebase bucket)
-- ============================================================
DROP POLICY IF EXISTS "service_role_storage_all" ON storage.objects;
CREATE POLICY "service_role_storage_all" ON storage.objects
  FOR ALL TO service_role
  USING (bucket_id = 'knowledgebase')
  WITH CHECK (bucket_id = 'knowledgebase');

-- ============================================================
-- 11. Authentication Trigger (Connects Sign Up directly to Leads)
-- ============================================================
-- When a user registers via Supabase Auth (Sign Up), automatically
-- create or link their contact/lead profile in the public.leads table.
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.leads (
    id,
    email,
    name,
    channel,
    lead_tier,
    lead_score
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    'web',
    'COLD',
    0
  )
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      name = COALESCE(EXCLUDED.name, leads.name),
      updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- Verify configuration
SELECT 'EduAssist Supabase setup (including Auth trigger) completed successfully!' AS status;

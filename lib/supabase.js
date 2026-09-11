import { createClient } from '@supabase/supabase-js';

// Server-side Supabase client (uses service role key for full access)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn('Supabase environment variables not set');
}

export const supabase = (supabaseUrl && supabaseServiceKey)
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    })
  : new Proxy({}, {
      get(target, prop) {
        throw new Error(
          `Supabase client method '${prop}' was called, but Supabase is not initialized. ` +
          `Please check that NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.`
        );
      }
    });

// ── Document Operations ──

export async function listDocuments() {
  const { data, error } = await supabase
    .from('kb_documents')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

export async function getDocument(id) {
  const { data, error } = await supabase
    .from('kb_documents')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

export async function createDocument({ filename, fileType, fileSize, storagePath, chunkCount }) {
  const { data, error } = await supabase
    .from('kb_documents')
    .insert({
      filename,
      file_type: fileType,
      file_size: fileSize,
      storage_path: storagePath,
      chunk_count: chunkCount,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteDocument(id) {
  // Get the document first to find storage path
  const doc = await getDocument(id);

  // Delete from storage
  if (doc.storage_path) {
    await supabase.storage
      .from('knowledgebase')
      .remove([doc.storage_path]);
  }

  // Delete document (chunks cascade automatically)
  const { error } = await supabase
    .from('kb_documents')
    .delete()
    .eq('id', id);

  if (error) throw error;
  return { success: true };
}

// ── Chunk Operations ──

export async function insertChunks(documentId, chunks) {
  const BATCH = 25;
  for (let i = 0; i < chunks.length; i += BATCH) {
    const rows = chunks.slice(i, i + BATCH).map((chunk) => ({
      document_id: documentId,
      content: chunk.content,
      chunk_index: chunk.chunkIndex,
      embedding: chunk.embedding,
      metadata: chunk.metadata || {},
    }));
    const { error } = await supabase.from('kb_chunks').insert(rows);
    if (error) throw error;
  }
}

export async function deleteChunksByDocument(documentId) {
  const { error } = await supabase
    .from('kb_chunks')
    .delete()
    .eq('document_id', documentId);

  if (error) throw error;
}

// ── Vector Search ──

export async function searchChunks(queryEmbedding, matchCount = 8, matchThreshold = 0.3) {
  const { data, error } = await supabase.rpc('match_kb_chunks', {
    query_embedding: queryEmbedding,
    match_threshold: matchThreshold,
    match_count: matchCount,
  });

  if (error) throw error;
  return data;
}

// ── Storage Operations ──

/**
 * Sanitize S3 object storage path to prevent 'Invalid key' errors with em-dashes, spaces, and special characters
 */
export function sanitizeStoragePath(rawPath) {
  if (!rawPath) return `documents/${Date.now()}-document`;

  const segments = rawPath.split('/');
  const rawFilename = segments.pop() || 'document';

  const parts = rawFilename.split('.');
  const ext = parts.length > 1 ? parts.pop() : '';
  const base = parts.join('.');

  const safeBase = base
    .normalize('NFKD')
    .replace(/[\u2010-\u2015\u2212\u2013\u2014]/g, '-')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[-_.]+|[-_.]+$/g, '')
    .slice(0, 100);

  const safeExt = ext ? `.${ext.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}` : '';
  const safeFilename = `${safeBase || 'document'}${safeExt}`;

  segments.push(safeFilename);
  return segments.join('/');
}

export async function uploadFile(file, path) {
  const safePath = sanitizeStoragePath(path);
  const { data, error } = await supabase.storage
    .from('knowledgebase')
    .upload(safePath, file, {
      upsert: true,
    });

  if (error) throw error;
  return { ...data, path: safePath };
}


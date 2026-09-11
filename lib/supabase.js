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

// ── Lead & Conversation Tracking ──

/**
 * Find existing lead by email or session, or create a new lead
 */
export async function findOrCreateLead({ email, name, sessionId }) {
  if (!email && !sessionId) return null;

  try {
    // Try finding by email first
    if (email) {
      const { data: existing } = await supabase
        .from('leads')
        .select('*')
        .eq('email', email.toLowerCase().trim())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existing) {
        // Update updated_at and name if missing
        const updates = { updated_at: new Date().toISOString() };
        if (!existing.name && name) updates.name = name;
        await supabase.from('leads').update(updates).eq('id', existing.id);
        return existing;
      }
    }

    // Try finding by session_id
    if (sessionId) {
      const { data: existingBySession } = await supabase
        .from('leads')
        .select('*')
        .eq('session_id', sessionId)
        .maybeSingle();

      if (existingBySession) {
        if (email && !existingBySession.email) {
          await supabase.from('leads').update({
            email: email.toLowerCase().trim(),
            name: name || existingBySession.name,
            updated_at: new Date().toISOString()
          }).eq('id', existingBySession.id);
        }
        return existingBySession;
      }
    }

    // Create new lead record
    const displayName = name || (email ? email.split('@')[0] : 'Anonymous Contact');
    const { data: newLead, error } = await supabase
      .from('leads')
      .insert({
        email: email ? email.toLowerCase().trim() : null,
        name: displayName,
        session_id: sessionId || `web_${Date.now()}`,
        channel: 'web',
        lead_tier: 'COLD',
        lead_score: 0,
      })
      .select()
      .single();

    if (error) {
      console.warn('Lead insert error:', error.message);
      return null;
    }
    return newLead;
  } catch (err) {
    console.error('findOrCreateLead exception:', err);
    return null;
  }
}

/**
 * Upsert conversation session and persist message history
 */
export async function saveConversation({ conversationId, sessionId, leadId, messages }) {
  if (!messages || messages.length === 0) return null;

  try {
    const isUUID = (str) =>
      typeof str === 'string' &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

    const lookupSessionId = sessionId || conversationId;
    let existing = null;

    // 1. Try finding by UUID if conversationId is a valid UUID
    if (conversationId && isUUID(conversationId)) {
      const { data } = await supabase
        .from('conversations')
        .select('id, lead_id')
        .eq('id', conversationId)
        .maybeSingle();
      existing = data;
    }

    // 2. Try finding by session_id
    if (!existing && lookupSessionId) {
      const { data } = await supabase
        .from('conversations')
        .select('id, lead_id')
        .eq('session_id', lookupSessionId)
        .maybeSingle();
      existing = data;
    }

    // 3. If found, update existing record
    if (existing) {
      const { data: updated, error } = await supabase
        .from('conversations')
        .update({
          messages,
          lead_id: leadId || existing.lead_id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (!error) return updated;
      console.warn('saveConversation update error:', error.message);
    }

    // 4. Otherwise insert new conversation
    const insertPayload = {
      session_id: lookupSessionId || `web_${Date.now()}`,
      lead_id: leadId || null,
      channel: 'web',
      messages,
      updated_at: new Date().toISOString(),
    };

    if (conversationId && isUUID(conversationId)) {
      insertPayload.id = conversationId;
    }

    const { data: created, error } = await supabase
      .from('conversations')
      .insert(insertPayload)
      .select()
      .single();

    if (error) {
      console.warn('saveConversation insert error:', error.message);
      return null;
    }
    return created;
  } catch (err) {
    console.error('saveConversation exception:', err);
    return null;
  }
}

/**
 * List past conversations for a user email
 */
export async function listUserConversations(email) {
  if (!email) return [];

  try {
    const { data: lead } = await supabase
      .from('leads')
      .select('id')
      .eq('email', email.toLowerCase().trim())
      .limit(1)
      .maybeSingle();

    if (!lead) return [];

    const { data: convs, error } = await supabase
      .from('conversations')
      .select('id, session_id, messages, created_at, updated_at')
      .eq('lead_id', lead.id)
      .order('updated_at', { ascending: false });

    if (error) throw error;

    return (convs || []).map((c) => {
      // Derive title from first user message or fallback
      const firstUserMsg = (c.messages || []).find((m) => m.role === 'user');
      const title = firstUserMsg
        ? (firstUserMsg.content || firstUserMsg.parts?.[0]?.text || 'Untitled Search').slice(0, 50)
        : 'Search Session';

      return {
        id: c.id,
        sessionId: c.session_id,
        title,
        messageCount: (c.messages || []).length,
        createdAt: c.created_at,
        updatedAt: c.updated_at,
      };
    });
  } catch (err) {
    console.error('listUserConversations error:', err);
    return [];
  }
}

/**
 * Get a specific conversation by ID (handles both UUID and session_id)
 */
export async function getConversationById(id) {
  try {
    const isUUID = (str) =>
      typeof str === 'string' &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

    let query = supabase.from('conversations').select('id, session_id, lead_id, messages, created_at, updated_at');
    if (isUUID(id)) {
      query = query.eq('id', id);
    } else {
      query = query.eq('session_id', id);
    }

    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    return data;
  } catch (err) {
    console.error('getConversationById error:', err);
    return null;
  }
}

/**
 * Delete a conversation by ID (handles both UUID and session_id)
 */
export async function deleteConversation(id) {
  try {
    const isUUID = (str) =>
      typeof str === 'string' &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

    let query = supabase.from('conversations').delete();
    if (isUUID(id)) {
      query = query.eq('id', id);
    } else {
      query = query.eq('session_id', id);
    }

    const { error } = await query;
    if (error) throw error;
    return { success: true };
  } catch (err) {
    console.error('deleteConversation error:', err);
    throw err;
  }
}

/**
 * List all contacts/leads and their search conversation stats for Admin Dashboard
 */
export async function listAllLeadsWithConversations() {
  try {
    const { data: leads, error: leadErr } = await supabase
      .from('leads')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(100);

    if (leadErr) throw leadErr;

    const leadIds = (leads || []).map((l) => l.id);
    if (leadIds.length === 0) return [];

    const { data: convs, error: convErr } = await supabase
      .from('conversations')
      .select('id, lead_id, messages, created_at, updated_at')
      .in('lead_id', leadIds)
      .order('updated_at', { ascending: false });

    if (convErr) throw convErr;

    return (leads || []).map((lead) => {
      const userConvs = (convs || []).filter((c) => c.lead_id === lead.id);
      const allMessages = userConvs.flatMap((c) => c.messages || []);
      const userQuestions = allMessages.filter((m) => m.role === 'user');

      return {
        ...lead,
        conversationCount: userConvs.length,
        totalSearches: userQuestions.length,
        latestSearch: userQuestions[userQuestions.length - 1]?.content || null,
        conversations: userConvs.map((c) => ({
          id: c.id,
          createdAt: c.created_at,
          updatedAt: c.updated_at,
          messages: c.messages || [],
        })),
      };
    });
  } catch (err) {
    console.error('listAllLeadsWithConversations error:', err);
    return [];
  }
}



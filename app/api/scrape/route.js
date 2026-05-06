import { generateEmbeddings } from '@/lib/embeddings';
import { supabase, insertChunks, deleteChunksByDocument } from '@/lib/supabase';
import { chunkText } from '@/lib/chunker';

export const maxDuration = 120;

function extractText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function findSubpageLinks(html, baseUrl) {
  try {
    const { hostname } = new URL(baseUrl);
    const seen = new Set([baseUrl]);
    const links = [];
    const re = /href=["']([^"']+)["']/gi;
    let m;
    while ((m = re.exec(html)) !== null) {
      try {
        const resolved = new URL(m[1], baseUrl).href.split('#')[0].split('?')[0];
        if (
          new URL(resolved).hostname === hostname &&
          !seen.has(resolved) &&
          !/\.(pdf|jpg|jpeg|png|gif|svg|mp4|zip|docx|xlsx|css|js|ico|woff|woff2)$/i.test(resolved) &&
          !/\/(login|signin|logout|register|admin|wp-admin|cart|checkout)/i.test(resolved)
        ) {
          seen.add(resolved);
          links.push(resolved);
        }
      } catch { /* skip malformed hrefs */ }
    }
    return links.slice(0, 9);
  } catch {
    return [];
  }
}

async function fetchHtml(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; EduTechBot/1.0; +https://edutechinternalchatbot.vercel.app)' },
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

export async function POST(request) {
  if (request.headers.get('x-admin-password') !== process.env.ADMIN_PASSWORD) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { url, documentId } = await request.json();
    if (!url) return Response.json({ error: 'URL is required' }, { status: 400 });

    let parsedUrl;
    try { parsedUrl = new URL(url); } catch {
      return Response.json({ error: 'Invalid URL format' }, { status: 400 });
    }
    const hostname = parsedUrl.hostname;

    // Fetch main page
    let mainHtml;
    try {
      mainHtml = await fetchHtml(url);
    } catch (e) {
      return Response.json({ error: `Cannot reach ${url}: ${e.message}` }, { status: 400 });
    }

    const pages = [];
    const mainText = extractText(mainHtml);
    if (mainText) pages.push({ url, text: mainText });

    // Fetch sub-pages
    const subLinks = findSubpageLinks(mainHtml, url);
    for (const subUrl of subLinks) {
      try {
        const html = await fetchHtml(subUrl);
        const text = extractText(html);
        if (text.length > 150) pages.push({ url: subUrl, text });
      } catch { /* skip unreachable sub-pages */ }
    }

    if (pages.length === 0) {
      return Response.json({ error: 'No text content could be extracted' }, { status: 400 });
    }

    // Combine pages with labels so the chunker preserves page context
    const combined = pages.map(p => `[Page: ${p.url}]\n${p.text}`).join('\n\n===\n\n');

    const chunks = chunkText(combined, hostname);
    if (!chunks.length) {
      return Response.json({ error: 'Text could not be chunked' }, { status: 400 });
    }

    const embeddings = await generateEmbeddings(chunks.map(c => c.content));
    const chunksReady = chunks.map((c, i) => ({
      ...c,
      embedding: embeddings[i],
      metadata: { ...c.metadata, source: hostname },
    }));

    if (documentId) {
      // Refresh existing web source: replace chunks, update record
      await deleteChunksByDocument(documentId);
      await insertChunks(documentId, chunksReady);
      const { data, error } = await supabase
        .from('kb_documents')
        .update({
          chunk_count: chunksReady.length,
          file_size: combined.length,
          updated_at: new Date().toISOString(),
        })
        .eq('id', documentId)
        .select()
        .single();
      if (error) throw error;
      return Response.json({ document: data, pagesScraped: pages.length });
    }

    // New web source: insert document record then chunks
    const { data: doc, error: docErr } = await supabase
      .from('kb_documents')
      .insert({
        filename: hostname,
        file_type: 'web',
        file_size: combined.length,
        storage_path: url,
        chunk_count: chunksReady.length,
      })
      .select()
      .single();
    if (docErr) throw docErr;

    await insertChunks(doc.id, chunksReady);

    return Response.json({ document: doc, pagesScraped: pages.length });

  } catch (err) {
    console.error('Scrape error:', err);
    return Response.json({ error: `Scraping failed: ${err.message}` }, { status: 500 });
  }
}

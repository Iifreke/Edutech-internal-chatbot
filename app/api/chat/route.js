import { streamText, convertToModelMessages } from 'ai';
import { openrouter, SYSTEM_PROMPT } from '@/lib/openrouter';
import { generateEmbedding } from '@/lib/embeddings';
import { searchChunks } from '@/lib/supabase';
import { searchInternet } from '@/lib/tavily';

export const maxDuration = 60;

export async function POST(request) {
  try {
    const { messages } = await request.json();

    if (!messages || messages.length === 0) {
      return Response.json({ error: 'No messages provided' }, { status: 400 });
    }

    // Get the latest user message for RAG search
    const lastMsg = messages[messages.length - 1];
    const userMessage = typeof lastMsg === 'string'
      ? lastMsg
      : lastMsg?.content || lastMsg?.parts?.map(p => p.text || '').join('') || '';

    if (!userMessage) {
      return Response.json({ error: 'Empty message' }, { status: 400 });
    }

    // Scores above HIGH_CONFIDENCE mean the KB has a solid answer — no internet needed.
    // Scores between WEAK_MATCH and HIGH_CONFIDENCE mean the KB found something partial
    // — supplement with an internet search. Below WEAK_MATCH means no KB match at all.
    const HIGH_CONFIDENCE = 0.6;
    const WEAK_MATCH      = 0.3;

    let contextText = '';
    let sourceMode  = 'none'; // 'kb_only' | 'kb_and_web' | 'web_only' | 'none'

    try {
      const queryEmbedding = await generateEmbedding(userMessage);
      const relevantChunks = await searchChunks(queryEmbedding, 8, WEAK_MATCH);

      const bestScore = relevantChunks?.length > 0
        ? Math.max(...relevantChunks.map(c => c.similarity))
        : 0;

      const buildKbContext = (chunks) =>
        chunks
          .map(c => `[Source: ${c.metadata?.source || 'Unknown document'}]\n${c.content}`)
          .join('\n\n---\n\n');

      const buildWebContext = (sr) => {
        if (!sr?.results?.length) return null;
        const parts = sr.results
          .map(r => `[Web Source: ${r.title}] (${r.url})\n${r.content}`)
          .join('\n\n---\n\n');
        return `AI SUMMARY: ${sr.answer || 'N/A'}\n\nDETAILED RESULTS:\n${parts}`;
      };

      if (bestScore >= HIGH_CONFIDENCE) {
        // KB has a confident answer — use it exclusively
        console.log(`[RAG] kb_only (best: ${bestScore.toFixed(3)})`);
        contextText = buildKbContext(relevantChunks);
        sourceMode  = 'kb_only';

      } else if (bestScore >= WEAK_MATCH) {
        // KB found something but it's weak — combine KB with internet search
        console.log(`[RAG] kb_and_web (best: ${bestScore.toFixed(3)})`);
        const kbCtx = buildKbContext(relevantChunks);
        let webCtx  = null;
        try {
          webCtx = buildWebContext(await searchInternet(userMessage));
        } catch (e) {
          console.error('[RAG] Internet search failed (weak match):', e);
        }

        if (webCtx) {
          contextText = `--- COMPANY DOCUMENTS ---\n\n${kbCtx}\n\n--- END COMPANY DOCUMENTS ---\n\n--- INTERNET SEARCH RESULTS ---\n\n${webCtx}\n\n--- END INTERNET RESULTS ---`;
          sourceMode  = 'kb_and_web';
        } else {
          // Internet failed — use the partial KB result rather than nothing
          contextText = kbCtx;
          sourceMode  = 'kb_only';
        }

      } else {
        // No usable KB results — fall back to internet search only
        console.log(`[RAG] web_only (best: ${bestScore.toFixed(3)})`);
        try {
          const webCtx = buildWebContext(await searchInternet(userMessage));
          if (webCtx) {
            contextText = webCtx;
            sourceMode  = 'web_only';
          }
        } catch (e) {
          console.error('[RAG] Internet search failed (no KB match):', e);
        }
      }

    } catch (err) {
      console.error('[RAG] Embedding/search error:', err);
    }

    // Build the augmented system prompt based on which sources are available
    let finalPrompt = SYSTEM_PROMPT;

    if (sourceMode === 'kb_only') {
      finalPrompt += `\n\n--- CONTEXT FROM COMPANY DOCUMENTS ---\n\n${contextText}\n\n--- END CONTEXT ---\n\nAnswer using only the company document context above. Do not reference external sources.`;

    } else if (sourceMode === 'kb_and_web') {
      finalPrompt += `\n\n${contextText}\n\nIMPORTANT: The knowledge base had partial information, so you also have internet search results. Synthesise both into a single cohesive answer. Prefer company documents for any organisation-specific facts. Begin your response with: "I found some related information in our internal documents and supplemented it with an internet search."`;

    } else if (sourceMode === 'web_only') {
      finalPrompt += `\n\n--- INTERNET SEARCH RESULTS ---\n\n${contextText}\n\n--- END SEARCH RESULTS ---\n\nThis question had no match in the Edutech Global knowledge base. Begin your response with: "I couldn't find this in our internal documents, so I've searched the internet for you." Answer based on the web results above. Do not invent any company-specific information.`;

    } else {
      // sourceMode === 'none': both KB and internet returned nothing
      finalPrompt += `\n\nNo relevant information was found in the knowledge base or via internet search. Tell the user clearly and politely that you don't have information on this topic yet, and suggest they contact their team lead or HR for help.`;
    }

    // Stream the response from OpenRouter
    const result = streamText({
      model: openrouter.chat('openai/gpt-4o-mini'),
      system: finalPrompt,
      messages: await convertToModelMessages(messages),
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error('Chat API error:', error);
    return Response.json(
      { error: 'Failed to process your question. Please try again.' },
      { status: 500 }
    );
  }
}

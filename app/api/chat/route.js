import { streamText, convertToModelMessages } from 'ai';
import { openrouter, SYSTEM_PROMPT } from '@/lib/openrouter';
import { generateEmbedding } from '@/lib/embeddings';
import { searchChunks } from '@/lib/supabase';

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

    // 1. Generate embedding for the user's question
    let contextText = '';

    try {
      const queryEmbedding = await generateEmbedding(userMessage);

      // 2. Search for relevant document chunks
      const relevantChunks = await searchChunks(queryEmbedding, 8, 0.3);

      if (relevantChunks && relevantChunks.length > 0) {
        const uniqueSources = new Set();
        const chunkTexts = relevantChunks.map((chunk) => {
          const source = chunk.metadata?.source || 'Unknown document';
          uniqueSources.add(source);
          return `[Source: ${source}]\n${chunk.content}`;
        });

        contextText = chunkTexts.join('\n\n---\n\n');
      }
    } catch (embeddingError) {
      console.error('Embedding/search error:', embeddingError);
    }

    // 3. Build the augmented system prompt
    const augmentedPrompt = contextText
      ? `${SYSTEM_PROMPT}\n\n--- CONTEXT FROM COMPANY DOCUMENTS ---\n\n${contextText}\n\n--- END CONTEXT ---`
      : `${SYSTEM_PROMPT}\n\nNote: No relevant documents were found in the knowledge base for this query. Let the user know you don't have information about their specific question yet.`;

    // 4. Stream the response from OpenRouter
    const result = streamText({
      model: openrouter('anthropic/claude-3.5-sonnet'),
      system: augmentedPrompt,
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

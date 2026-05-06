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

    // 1. Generate embedding for the user's question
    let contextText = '';
    let isFromInternet = false;

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
      } else {
        // Fallback to Internet Search
        console.log('No relevant documents found. Searching the internet...');
        const searchResults = await searchInternet(userMessage);
        
        if (searchResults && searchResults.results && searchResults.results.length > 0) {
          isFromInternet = true;
          const webContext = searchResults.results.map(r => 
            `[Web Source: ${r.title}] (${r.url})\n${r.content}`
          ).join('\n\n---\n\n');
          
          contextText = `AI SUMMARY OF WEB RESULTS: ${searchResults.answer || 'N/A'}\n\nDETAILED WEB RESULTS:\n${webContext}`;
        }
      }
    } catch (embeddingError) {
      console.error('Search error:', embeddingError);
    }

    // 3. Build the augmented system prompt
    let finalPrompt = SYSTEM_PROMPT;
    
    if (contextText) {
      if (isFromInternet) {
        finalPrompt += `\n\nIMPORTANT: No information was found in the Edutech Global internal knowledge base. You have performed an internet search instead. 
        \n\n--- INTERNET SEARCH RESULTS ---\n\n${contextText}\n\n--- END SEARCH RESULTS ---
        \n\nPlease start your response by saying: "I couldn't find information on this in our internal documents, so I've checked the internet for you." Then answer based on the search results.`;
      } else {
        finalPrompt += `\n\n--- CONTEXT FROM COMPANY DOCUMENTS ---\n\n${contextText}\n\n--- END CONTEXT ---`;
      }
    } else {
      finalPrompt += `\n\nNote: No relevant documents were found in the knowledge base and no internet search results were available. Let the user know you don't have information about their specific question yet.`;
    }

    // 4. Stream the response from OpenRouter
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

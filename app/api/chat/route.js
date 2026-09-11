import { streamText, convertToModelMessages } from 'ai';
import { chatModel, SYSTEM_PROMPT } from '@/lib/openai';
import { generateEmbedding } from '@/lib/embeddings';
import { searchChunks, findOrCreateLead, saveConversation } from '@/lib/supabase';

export const maxDuration = 60;

export async function POST(request) {
  try {
    const { messages, conversationId, sessionId, user } = await request.json();

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

    let contextText = '';
    let hasKbMatch = false;

    // Search internal knowledge base only (Strictly NO internet search)
    try {
      const queryEmbedding = await generateEmbedding(userMessage);
      const relevantChunks = await searchChunks(queryEmbedding, 6, 0.35);

      if (relevantChunks && relevantChunks.length > 0) {
        hasKbMatch = true;
        contextText = relevantChunks
          .map(c => `[Source: ${c.metadata?.source || 'Company Document'}]\n${c.content}`)
          .join('\n\n---\n\n');
      }
    } catch (err) {
      console.error('[RAG] Internal KB embedding/search error:', err);
    }

    // Build the system prompt strictly based on internal knowledge base
    let finalPrompt = SYSTEM_PROMPT;

    if (hasKbMatch && contextText) {
      finalPrompt += `\n\n--- CONTEXT FROM OFFICIAL COMPANY DOCUMENTS ---\n\n${contextText}\n\n--- END CONTEXT ---\n\nAnswer using ONLY the company document context above. If the context does not explicitly contain the answer, say clearly that you don't have that specific information in the company knowledge base and advise contacting HR or their team lead. Never make up information or refer to internet search.`;
    } else {
      finalPrompt += `\n\nNo relevant information was found in the official Edutech Global knowledge base for this question. Do not attempt to guess or use outside internet knowledge. Politely inform the user that this topic is not yet covered in our internal knowledge base, and advise them to reach out to their team lead, supervisor, or HR.`;
    }

    // Stream the response from OpenAI (gpt-4o-mini)
    const result = streamText({
      model: chatModel,
      system: finalPrompt,
      messages: await convertToModelMessages(messages),
      onFinish: async ({ text }) => {
        try {
          const userEmail = user?.email;
          const userName = user?.name || userEmail?.split('@')[0];
          const activeConvId = conversationId || sessionId || `conv_${Date.now()}`;

          // Find or create lead for the contact
          let lead = null;
          if (userEmail || activeConvId) {
            lead = await findOrCreateLead({
              email: userEmail,
              name: userName,
              sessionId: activeConvId,
            });
          }

          // Format full conversation history with the assistant response
          const fullHistory = [
            ...messages.map((m, idx) => ({
              id: m.id || `msg_${idx}_${Date.now()}`,
              role: m.role,
              content: typeof m.content === 'string'
                ? m.content
                : m.parts?.map((p) => p.text || '').join('') || '',
            })),
            {
              id: `msg_asst_${Date.now()}`,
              role: 'assistant',
              content: text,
              createdAt: new Date().toISOString(),
            },
          ];

          // Save / update conversation thread
          await saveConversation({
            conversationId: activeConvId,
            sessionId: activeConvId,
            leadId: lead?.id,
            messages: fullHistory,
          });
        } catch (saveErr) {
          console.error('[Chat] Failed to persist contact search and conversation:', saveErr);
        }
      },
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


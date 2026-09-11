import { streamText, generateText, convertToModelMessages } from 'ai';
import { chatModel, SYSTEM_PROMPT } from '@/lib/openai';
import { generateEmbedding } from '@/lib/embeddings';
import { searchChunks, findOrCreateLead, saveConversation } from '@/lib/supabase';

export const maxDuration = 60;

/**
 * Intelligent intent analyzer and query reformulator.
 * Converts conversational, follow-up, or emotionally loaded multi-turn questions
 * into clean, pronoun-resolved standalone search queries for vector retrieval.
 */
async function reformulateQuery(messages, latestMessage) {
  try {
    const trimmed = latestMessage.trim().toLowerCase();
    const commonGreetings = [
      'hi', 'hello', 'hey', 'good morning', 'good afternoon', 'good evening',
      'how are you', 'what can you do', 'who are you', 'help', 'thanks',
      'thank you', 'ok', 'okay', 'bye', 'goodbye', 'cool', 'got it'
    ];

    // If single message and is simple greeting
    if (messages.length <= 1 && commonGreetings.includes(trimmed.replace(/[!?,.]/g, ''))) {
      return { isConversational: true, query: null };
    }

    // Prepare recent conversational context (up to last 6 messages prior to the latest)
    const historySlice = messages.slice(-7, -1);
    const historyText = historySlice
      .map((m) => {
        const role = m.role === 'user' ? 'User' : 'Assistant';
        const content = typeof m.content === 'string'
          ? m.content
          : m.parts?.map((p) => p.text || '').join('') || '';
        return `${role}: ${content.slice(0, 350)}`;
      })
      .join('\n');

    const reformulationPrompt = `You are the intent analyzer and query reformulator for EduAssist, Edutech Global's internal knowledge base AI.
Your job is to convert the user's latest message into an optimal standalone search query to retrieve relevant company documents from our vector database.

RULES:
1. Identify what specific topic, entity, or process the user is asking about.
2. Resolve pronouns and contextual references ("they", "them", "that team", "who are they", "the project", "the policy", "it", "the first one", "the initiative") based on the chat history.
3. STRIP OUT emotional filler, frustration, insults, or conversational noise (e.g. "don't be stupid", "are you dumb", "wtf", "come on", "answer properly"). Never include emotional words in the query.
4. If and only if the user's message is pure greeting, thank you, acknowledgment, or farewell (e.g. "hi", "thanks", "ok", "bye") with NO question being asked, output exactly: INTENT:CONVERSATIONAL
5. Output ONLY the clean, standalone search query (max 10 words).

EXAMPLES:
Context:
Assistant: "Interns should report directly to their assigned mentors and may reach out to their team lead."
User: "dont be stupid who are they again"
Output: Edutech Global intern mentors and team leads

Context:
Assistant: "We offer Purple Squirrel, Study Buddy, and The Hub."
User: "how much does the second one cost?"
Output: Study Buddy pricing and subscription cost

Context:
User: "Hello, good morning"
Output: INTENT:CONVERSATIONAL

Context:
${historyText || '(No previous history)'}
User: ${latestMessage}
Output:`;

    const { text } = await generateText({
      model: chatModel,
      prompt: reformulationPrompt,
      temperature: 0,
    });

    const result = text.trim();
    if (result.includes('INTENT:CONVERSATIONAL')) {
      return { isConversational: true, query: null };
    }

    const cleanQuery = result
      .replace(/^["']|["']$/g, '')
      .replace(/^Standalone Search Query:\s*/i, '')
      .replace(/^Output:\s*/i, '')
      .replace(/^Query:\s*/i, '')
      .trim();

    return { isConversational: false, query: cleanQuery || latestMessage };
  } catch (err) {
    console.warn('[RAG] Query reformulation exception, fallback to raw message:', err.message);
    return { isConversational: false, query: latestMessage };
  }
}

export async function POST(request) {
  try {
    const { messages, conversationId, sessionId, user } = await request.json();

    if (!messages || messages.length === 0) {
      return Response.json({ error: 'No messages provided' }, { status: 400 });
    }

    // Get the latest user message
    const lastMsg = messages[messages.length - 1];
    const userMessage = typeof lastMsg === 'string'
      ? lastMsg
      : lastMsg?.content || lastMsg?.parts?.map((p) => p.text || '').join('') || '';

    if (!userMessage) {
      return Response.json({ error: 'Empty message' }, { status: 400 });
    }

    // Step 1: Intelligent Intent Analysis & Query Reformulation
    const { isConversational, query: searchQuery } = await reformulateQuery(messages, userMessage);

    let contextText = '';
    let hasKbMatch = false;

    // Step 2: Internal Vector Retrieval (Strictly internal KB only)
    if (!isConversational && searchQuery) {
      try {
        console.log(`[RAG] Reformulated search query: "${searchQuery}" (Original: "${userMessage}")`);
        const queryEmbedding = await generateEmbedding(searchQuery);
        let relevantChunks = await searchChunks(queryEmbedding, 6, 0.28);

        // Fallback: If 0 chunks found and the user message has distinct terms, try raw query
        if ((!relevantChunks || relevantChunks.length === 0) && userMessage !== searchQuery) {
          try {
            const rawEmbedding = await generateEmbedding(userMessage);
            const fallbackChunks = await searchChunks(rawEmbedding, 4, 0.28);
            if (fallbackChunks && fallbackChunks.length > 0) {
              relevantChunks = fallbackChunks;
            }
          } catch (fbErr) {
            console.warn('[RAG] Raw fallback search error:', fbErr.message);
          }
        }

        if (relevantChunks && relevantChunks.length > 0) {
          hasKbMatch = true;
          contextText = relevantChunks
            .map((c, idx) => {
              const src = c.metadata?.source || 'Internal Company Document';
              return `[Document ${idx + 1}: ${src}]\n${c.content}`;
            })
            .join('\n\n---\n\n');
        }
      } catch (err) {
        console.error('[RAG] Internal KB embedding/search error:', err);
      }
    }

    // Step 3: Build Augmented Prompt with Context and Guardrails
    let finalPrompt = SYSTEM_PROMPT;

    if (hasKbMatch && contextText) {
      finalPrompt += `\n\n=== RELEVANT CONTEXT FROM OFFICIAL EDUTECH GLOBAL DOCUMENTS ===\n${contextText}\n=== END OFFICIAL CONTEXT ===\n\nInstructions for this response:
- Answer the user's latest question directly, clearly, and thoroughly based on the official company document context above and the chat history.
- If the user was asking a follow-up or expressed frustration/confusion (e.g. asking "who are they again?" or using colloquial language), remain composed, courteous, and helpful. Clarify the answer immediately with specific roles and structures from the documents.
- If specific individual personal names are not listed in the documents, explain the documented roles/reporting structures (e.g. line managers, supervisors, mentors) and direct them to the appropriate internal contact point (e.g. HR at clientservice@edutech.global or their department lead).
- Do NOT make up outside information, song lyrics, pop culture, or mention internet searches.`;
    } else if (isConversational) {
      finalPrompt += `\n\nThis is a conversational interaction (greeting, acknowledgment, gratitude, or small talk). Respond in a warm, helpful, and professional manner as EduAssist, ready to assist with any Edutech Global questions.`;
    } else {
      finalPrompt += `\n\nSearch attempted for: "${searchQuery || userMessage}". No matching documents were found in the official internal knowledge base.
Instructions for this response:
- If this inquiry directly follows from earlier topics in the conversation, use the ongoing conversation context to provide a helpful, coherent explanation.
- If the user is asking for specific internal company data or policies that are genuinely not documented in our knowledge base, politely inform them that this specific topic is not yet covered in our uploaded documents, and recommend reaching out to HR (clientservice@edutech.global) or their supervisor.
- Never guess, invent facts, or reference external internet/pop-culture information.`;
    }

    // Step 4: Stream response using gpt-4o-mini
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

          // Persist conversation thread to Supabase
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

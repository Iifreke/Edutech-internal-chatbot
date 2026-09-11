import { createClient } from '@supabase/supabase-js';
import { listUserConversations, saveConversation, findOrCreateLead } from '@/lib/supabase';

async function getEmailFromToken(request) {
  try {
    const auth = request.headers.get('Authorization');
    if (!auth?.startsWith('Bearer ')) return null;
    const token = auth.slice(7);
    const client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
    const { data: { user } } = await client.auth.getUser(token);
    return user?.email ?? null;
  } catch {
    return null;
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');
    if (!email) return Response.json({ conversations: [] });
    const conversations = await listUserConversations(email);
    return Response.json({ conversations });
  } catch (error) {
    console.error('List conversations error:', error);
    return Response.json({ error: 'Failed to fetch conversations' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const email = await getEmailFromToken(request);
    if (!email) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { conversationId, sessionId, messages } = await request.json();
    const activeId = conversationId || sessionId || `conv_${Date.now()}`;

    const lead = await findOrCreateLead({
      email,
      name: email.split('@')[0],
      sessionId: activeId,
    });

    const conv = await saveConversation({
      conversationId: activeId,
      sessionId: activeId,
      leadId: lead?.id,
      messages: messages || [],
    });

    return Response.json({ success: true, id: conv?.id ?? activeId });
  } catch (error) {
    console.error('Save conversation error:', error);
    return Response.json({ error: 'Failed to save conversation' }, { status: 500 });
  }
}

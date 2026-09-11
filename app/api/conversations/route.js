import { listUserConversations, saveConversation, findOrCreateLead } from '@/lib/supabase';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');

    if (!email) {
      return Response.json({ conversations: [] });
    }

    const conversations = await listUserConversations(email);
    return Response.json({ conversations });
  } catch (error) {
    console.error('List conversations error:', error);
    return Response.json({ error: 'Failed to fetch conversations' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { email, name, title } = await request.json();
    const sessionId = `conv_${Date.now()}`;

    let lead = null;
    if (email) {
      lead = await findOrCreateLead({
        email,
        name: name || email.split('@')[0],
        sessionId,
      });
    }

    const initialMessages = [];
    const conv = await saveConversation({
      sessionId,
      leadId: lead?.id,
      messages: initialMessages,
    });

    return Response.json({
      success: true,
      conversation: {
        id: conv ? conv.id : sessionId,
        sessionId,
        title: title || 'New Search',
        messages: [],
      },
    });
  } catch (error) {
    console.error('Create conversation error:', error);
    return Response.json({ error: 'Failed to create conversation' }, { status: 500 });
  }
}

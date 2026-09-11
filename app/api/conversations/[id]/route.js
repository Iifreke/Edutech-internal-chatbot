import { getConversationById, deleteConversation } from '@/lib/supabase';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    if (!id) {
      return Response.json({ error: 'Conversation ID is required' }, { status: 400 });
    }

    const conversation = await getConversationById(id);
    if (!conversation) {
      return Response.json({ error: 'Conversation not found' }, { status: 404 });
    }

    return Response.json({ conversation });
  } catch (error) {
    console.error('Get conversation error:', error);
    return Response.json({ error: 'Failed to fetch conversation' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    if (!id) {
      return Response.json({ error: 'Conversation ID is required' }, { status: 400 });
    }

    await deleteConversation(id);
    return Response.json({ success: true, message: 'Conversation deleted' });
  } catch (error) {
    console.error('Delete conversation error:', error);
    return Response.json({ error: 'Failed to delete conversation' }, { status: 500 });
  }
}

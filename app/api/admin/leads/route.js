import { listAllLeadsWithConversations } from '@/lib/supabase';

export async function GET(request) {
  try {
    const authHeader = request.headers.get('x-admin-password');
    if (authHeader !== process.env.ADMIN_PASSWORD) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const leads = await listAllLeadsWithConversations();
    return Response.json({ leads });
  } catch (error) {
    console.error('List admin leads error:', error);
    return Response.json({ error: 'Failed to fetch contact leads' }, { status: 500 });
  }
}

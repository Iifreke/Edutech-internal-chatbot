import { listDocuments, deleteDocument } from '@/lib/supabase';

export async function GET() {
  try {
    const documents = await listDocuments();
    return Response.json({ documents });
  } catch (error) {
    console.error('List documents error:', error);
    return Response.json(
      { error: 'Failed to fetch documents' },
      { status: 500 }
    );
  }
}

export async function DELETE(request) {
  try {
    // Verify admin password
    const authHeader = request.headers.get('x-admin-password');
    if (authHeader !== process.env.ADMIN_PASSWORD) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return Response.json({ error: 'Document ID required' }, { status: 400 });
    }

    await deleteDocument(id);

    return Response.json({ success: true, message: 'Document deleted successfully' });
  } catch (error) {
    console.error('Delete document error:', error);
    return Response.json(
      { error: `Failed to delete document: ${error.message}` },
      { status: 500 }
    );
  }
}

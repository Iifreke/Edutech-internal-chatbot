import { parseFile, getFileType } from '@/lib/parsers';
import { chunkText } from '@/lib/chunker';
import { generateEmbeddings } from '@/lib/embeddings';
import { deleteChunksByDocument, insertChunks, uploadFile, supabase } from '@/lib/supabase';

export const maxDuration = 120;

export async function POST(request) {
  try {
    // Verify admin password
    const authHeader = request.headers.get('x-admin-password');
    if (authHeader !== process.env.ADMIN_PASSWORD) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file');
    const documentId = formData.get('documentId');

    if (!file || !documentId) {
      return Response.json(
        { error: 'File and document ID are required' },
        { status: 400 }
      );
    }

    const filename = file.name;
    const fileType = getFileType(filename);

    if (fileType === 'unknown') {
      return Response.json(
        { error: 'Unsupported file type.' },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // 1. Delete old chunks
    await deleteChunksByDocument(documentId);

    // 2. Upload new file to storage
    const storagePath = `documents/${Date.now()}-${filename}`;
    await uploadFile(buffer, storagePath);

    // 3. Parse and chunk
    const text = await parseFile(buffer, filename);
    const chunks = chunkText(text, filename);

    // 4. Generate embeddings
    const chunkTexts = chunks.map((c) => c.content);
    const embeddings = await generateEmbeddings(chunkTexts);

    const chunksWithEmbeddings = chunks.map((chunk, i) => ({
      ...chunk,
      embedding: embeddings[i],
    }));

    // 5. Insert new chunks
    await insertChunks(documentId, chunksWithEmbeddings);

    // 6. Update document record
    const { error } = await supabase
      .from('kb_documents')
      .update({
        filename,
        file_type: fileType,
        file_size: file.size,
        storage_path: storagePath,
        chunk_count: chunks.length,
        updated_at: new Date().toISOString(),
      })
      .eq('id', documentId);

    if (error) throw error;

    return Response.json({
      success: true,
      document: {
        id: documentId,
        filename,
        chunkCount: chunks.length,
      },
    });
  } catch (error) {
    console.error('Reprocess error:', error);
    return Response.json(
      { error: `Reprocess failed: ${error.message}` },
      { status: 500 }
    );
  }
}

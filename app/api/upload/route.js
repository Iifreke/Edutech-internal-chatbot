import { parseFile, getFileType } from '@/lib/parsers';
import { chunkText } from '@/lib/chunker';
import { generateEmbeddings } from '@/lib/embeddings';
import { createDocument, insertChunks, uploadFile } from '@/lib/supabase';

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

    if (!file) {
      return Response.json({ error: 'No file provided' }, { status: 400 });
    }

    const filename = file.name;
    const fileType = getFileType(filename);

    if (fileType === 'unknown') {
      return Response.json(
        { error: 'Unsupported file type. Please upload PDF, DOCX, or XLSX files.' },
        { status: 400 }
      );
    }

    // Size check (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      return Response.json(
        { error: 'File too large. Maximum size is 10MB.' },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // 1. Upload original file to Supabase Storage
    const storagePath = `documents/${Date.now()}-${filename}`;
    await uploadFile(buffer, storagePath);

    // 2. Parse file to text
    const text = await parseFile(buffer, filename);

    if (!text || text.trim().length === 0) {
      return Response.json(
        { error: 'Could not extract any text from the file.' },
        { status: 400 }
      );
    }

    // 3. Chunk the text
    const chunks = chunkText(text, filename);

    // 4. Generate embeddings for all chunks
    const chunkTexts = chunks.map((c) => c.content);
    const embeddings = await generateEmbeddings(chunkTexts);

    // 5. Attach embeddings to chunks
    const chunksWithEmbeddings = chunks.map((chunk, i) => ({
      ...chunk,
      embedding: embeddings[i],
    }));

    // 6. Create document record
    const doc = await createDocument({
      filename,
      fileType,
      fileSize: file.size,
      storagePath,
      chunkCount: chunks.length,
    });

    // 7. Insert chunks with embeddings
    await insertChunks(doc.id, chunksWithEmbeddings);

    return Response.json({
      success: true,
      document: {
        id: doc.id,
        filename: doc.filename,
        fileType: doc.file_type,
        fileSize: doc.file_size,
        chunkCount: chunks.length,
      },
    });
  } catch (error) {
    console.error('Upload error:', error);
    return Response.json(
      { error: `Upload failed: ${error.message}` },
      { status: 500 }
    );
  }
}

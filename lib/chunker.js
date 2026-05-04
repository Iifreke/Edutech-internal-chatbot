/**
 * Split text into overlapping chunks suitable for embedding
 * 
 * Strategy:
 * - Target ~800 characters per chunk
 * - 100 character overlap between chunks
 * - Respect paragraph boundaries where possible
 * - Preserve context by not splitting mid-sentence
 */

const DEFAULT_CHUNK_SIZE = 800;
const DEFAULT_OVERLAP = 100;

/**
 * Chunk text into overlapping segments
 * @param {string} text - The full text to chunk
 * @param {string} filename - Source filename for metadata
 * @param {object} options - Chunking options
 * @returns {Array<{content: string, chunkIndex: number, metadata: object}>}
 */
export function chunkText(text, filename, options = {}) {
  const chunkSize = options.chunkSize || DEFAULT_CHUNK_SIZE;
  const overlap = options.overlap || DEFAULT_OVERLAP;

  // Clean the text
  const cleanedText = text
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleanedText || cleanedText.length === 0) {
    return [];
  }

  // If text is small enough, return as single chunk
  if (cleanedText.length <= chunkSize) {
    return [
      {
        content: cleanedText,
        chunkIndex: 0,
        metadata: {
          source: filename,
          totalChunks: 1,
          charStart: 0,
          charEnd: cleanedText.length,
        },
      },
    ];
  }

  // Split into paragraphs first
  const paragraphs = cleanedText.split(/\n\n+/);
  const chunks = [];
  let currentChunk = '';
  let chunkIndex = 0;
  let charStart = 0;

  for (const paragraph of paragraphs) {
    // If adding this paragraph exceeds chunk size, finalize current chunk
    if (currentChunk.length + paragraph.length > chunkSize && currentChunk.length > 0) {
      chunks.push({
        content: currentChunk.trim(),
        chunkIndex,
        metadata: {
          source: filename,
          charStart,
          charEnd: charStart + currentChunk.length,
        },
      });

      // Start new chunk with overlap from end of previous
      const overlapText = currentChunk.slice(-overlap);
      charStart = charStart + currentChunk.length - overlap;
      currentChunk = overlapText;
      chunkIndex++;
    }

    // If a single paragraph is too long, split it by sentences
    if (paragraph.length > chunkSize) {
      const sentences = paragraph.match(/[^.!?]+[.!?]+\s*/g) || [paragraph];

      for (const sentence of sentences) {
        if (currentChunk.length + sentence.length > chunkSize && currentChunk.length > 0) {
          chunks.push({
            content: currentChunk.trim(),
            chunkIndex,
            metadata: {
              source: filename,
              charStart,
              charEnd: charStart + currentChunk.length,
            },
          });

          const overlapText = currentChunk.slice(-overlap);
          charStart = charStart + currentChunk.length - overlap;
          currentChunk = overlapText;
          chunkIndex++;
        }
        currentChunk += sentence;
      }
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
    }
  }

  // Don't forget the last chunk
  if (currentChunk.trim().length > 0) {
    chunks.push({
      content: currentChunk.trim(),
      chunkIndex,
      metadata: {
        source: filename,
        charStart,
        charEnd: charStart + currentChunk.length,
      },
    });
  }

  // Add totalChunks to all metadata
  const totalChunks = chunks.length;
  chunks.forEach((chunk) => {
    chunk.metadata.totalChunks = totalChunks;
  });

  return chunks;
}

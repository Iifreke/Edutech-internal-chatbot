/**
 * Generate embeddings using OpenAI's embeddings API
 * Uses OpenAI's text-embedding-3-small model (1536 dimensions)
 */

const EMBEDDING_MODEL = 'text-embedding-3-small';
const OPENAI_BASE_URL = 'https://api.openai.com/v1';
const BATCH_SIZE = 20;

/**
 * Generate a single embedding vector for a text string
 * @param {string} text - Text to embed
 * @returns {Promise<number[]>} - 1536-dimensional embedding vector
 */
export async function generateEmbedding(text) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not set in environment variables');
  }

  const response = await fetch(`${OPENAI_BASE_URL}/embeddings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: text,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI Embedding API error (${response.status}): ${err}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

/**
 * Generate embeddings for multiple texts in batches
 * @param {string[]} texts - Array of texts to embed
 * @returns {Promise<number[][]>} - Array of embedding vectors
 */
export async function generateEmbeddings(texts) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not set in environment variables');
  }

  const allEmbeddings = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);

    const response = await fetch(`${OPENAI_BASE_URL}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: batch,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenAI Embedding API error (batch ${i}): ${response.status} — ${err}`);
    }

    const data = await response.json();
    const embeddings = data.data
      .sort((a, b) => a.index - b.index)
      .map((d) => d.embedding);

    allEmbeddings.push(...embeddings);

    // Small delay between batches to respect rate limits
    if (i + BATCH_SIZE < texts.length) {
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  return allEmbeddings;
}

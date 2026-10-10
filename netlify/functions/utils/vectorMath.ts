import type { Chunk } from "./storage";

export interface RankedChunk {
  chunk: Chunk;
  score: number;
}

/**
 * Calculates dot-product cosine similarity between two normalized float vectors.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
  }
  return dot;
}

/**
 * Vectorized ranking: scores all chunks against the query vector,
 * applies a minimum similarity threshold, and returns the top-K matches.
 */
export function rankChunks(
  queryVector: number[],
  chunks: Chunk[],
  topK: number = 4,
  minSimilarity: number = 0.15
): RankedChunk[] {
  const scored: RankedChunk[] = [];

  for (const chunk of chunks) {
    if (!chunk.embedding || chunk.embedding.length === 0) continue;
    const score = cosineSimilarity(queryVector, chunk.embedding);
    if (score >= minSimilarity) {
      scored.push({ chunk, score });
    }
  }

  // Sort descending by similarity score
  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, topK);
}

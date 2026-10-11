import type { Chunk } from "./storage";

export interface RankedChunk {
  chunk: Chunk;
  score: number;
}

/**
 * Standard English stopwords used to prevent common grammatical words
 * from artificially dominating lexical keyword relevance in hybrid scoring.
 */
export const STOPWORDS = new Set([
  "a", "about", "above", "after", "again", "against", "all", "am", "an", "and", "any", "are", "aren",
  "as", "at", "be", "because", "been", "before", "being", "below", "between", "both", "but", "by",
  "can", "could", "did", "do", "does", "doing", "down", "during", "each", "few", "for", "from",
  "further", "had", "has", "have", "having", "he", "her", "here", "hers", "herself", "him",
  "himself", "his", "how", "i", "if", "in", "into", "is", "isn", "it", "its", "itself", "just",
  "ll", "m", "me", "might", "more", "most", "must", "my", "myself", "no", "nor", "not", "now",
  "o", "of", "off", "on", "once", "only", "or", "other", "our", "ours", "ourselves", "out", "over",
  "own", "re", "s", "same", "she", "should", "so", "some", "such", "t", "than", "that", "the",
  "their", "theirs", "them", "themselves", "then", "there", "these", "they", "this", "those",
  "through", "to", "too", "under", "until", "up", "ve", "very", "was", "wasn", "we", "were",
  "weren", "what", "when", "where", "which", "while", "who", "whom", "why", "will", "with",
  "won", "would", "y", "you", "your", "yours", "yourself", "yourselves"
]);

export function tokenize(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
}

/**
 * Calculates Robertson-Spärck Jones BM25 scores for a set of candidate chunks.
 * k1 = 1.2, b = 0.75
 */
export function computeBM25Scores(queryTokens: string[], chunks: Chunk[]): number[] {
  const N = chunks.length;
  if (N === 0 || queryTokens.length === 0) return chunks.map(() => 0);

  const chunkTokens = chunks.map((c) => tokenize(c.text));
  const docFreqs = new Map<string, number>();
  let totalDocLen = 0;

  for (const tokens of chunkTokens) {
    totalDocLen += tokens.length;
    const unique = new Set(tokens);
    for (const t of unique) {
      docFreqs.set(t, (docFreqs.get(t) || 0) + 1);
    }
  }

  const avgdl = totalDocLen / N || 1;
  const k1 = 1.2;
  const b = 0.75;

  return chunkTokens.map((tokens) => {
    let score = 0;
    const counts = new Map<string, number>();
    for (const t of tokens) {
      counts.set(t, (counts.get(t) || 0) + 1);
    }
    const dl = tokens.length;

    for (const q of queryTokens) {
      const df = docFreqs.get(q) || 0;
      if (df === 0) continue;
      const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
      const tf = counts.get(q) || 0;
      const tfComponent = (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * (dl / avgdl)));
      score += idf * tfComponent;
    }
    return score;
  });
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
 * Vectorized & hybrid ranking:
 * - If queryText is provided: calculates normalized BM25 lexical relevance and combines it
 *   with dense semantic cosine similarity (0.5 dense + 0.5 normalized BM25).
 * - If queryText is omitted or lexical matches are absent: uses pure dense cosine similarity.
 * - Filters by minSimilarity (default 0.15) and returns the top-K matches (default 8).
 */
export function rankChunks(
  queryVector: number[],
  chunks: Chunk[],
  topK: number = 8,
  minSimilarity: number = 0.15,
  queryText?: string
): RankedChunk[] {
  const scored: RankedChunk[] = [];
  if (chunks.length === 0) return scored;

  const denseScores = chunks.map((chunk) => {
    if (!chunk.embedding || chunk.embedding.length === 0) return 0;
    return cosineSimilarity(queryVector, chunk.embedding);
  });

  let hybridScores: number[] = denseScores;

  if (queryText && queryText.trim().length > 0) {
    const allTokens = tokenize(queryText);
    const contentTokens = allTokens.filter((t) => !STOPWORDS.has(t));
    const tokensForBM25 = contentTokens.length > 0 ? contentTokens : allTokens;

    if (tokensForBM25.length > 0) {
      const bm25RawScores = computeBM25Scores(tokensForBM25, chunks);
      const maxBM25 = Math.max(...bm25RawScores, 0);

      if (maxBM25 > 1e-5) {
        hybridScores = chunks.map((_, i) => {
          const lexNorm = bm25RawScores[i] / maxBM25;
          return 0.5 * denseScores[i] + 0.5 * lexNorm;
        });
      }
    }
  }

  for (let i = 0; i < chunks.length; i++) {
    const score = hybridScores[i];
    if (score >= minSimilarity) {
      scored.push({ chunk: chunks[i], score });
    }
  }

  // Sort descending by similarity score
  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, topK);
}

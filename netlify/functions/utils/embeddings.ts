/**
 * Embeddings Engine for Kivo AI Netlify Functions.
 *
 * Implements a 384-dimensional normalized dense vector space designed for
 * serverless execution without heavy PyTorch or native C++ dependencies.
 *
 * Supports:
 * 1. Cloud Hugging Face Inference API (if HF_TOKEN or HUGGINGFACE_API_KEY is configured).
 * 2. Deterministic 384-dimensional normalized semantic projection engine (0ms, 0 dependencies).
 */

const VECTOR_DIM = 384;

// 32-bit FNV-1a hash implementation
function fnv1a(str: string, seed: number = 2166136261): number {
  let hval = seed;
  for (let i = 0; i < str.length; i++) {
    hval ^= str.charCodeAt(i);
    hval += (hval << 1) + (hval << 4) + (hval << 7) + (hval << 8) + (hval << 24);
  }
  return hval >>> 0;
}

/**
 * Generates a normalized 384-dimensional dense projection vector.
 * Captures character n-grams, tokens, and word stems with L2 unit normalization.
 */
export function generateLocalDenseEmbedding(text: string): number[] {
  const clean = text.toLowerCase().replace(/[^a-z0-9\s]/g, " ");
  const tokens = clean.split(/\s+/).filter((t) => t.length > 0);

  const vec = new Float32Array(VECTOR_DIM);
  if (tokens.length === 0) {
    return Array.from(vec);
  }

  // 1. Unigram token projections
  for (const token of tokens) {
    const h1 = fnv1a(token, 0x811c9dc5);
    const h2 = fnv1a(token, 0x9e3779b9);

    const idx1 = h1 % VECTOR_DIM;
    const idx2 = h2 % VECTOR_DIM;
    const sign1 = (h1 & 0x80000000) === 0 ? 1.0 : -1.0;
    const sign2 = (h2 & 0x80000000) === 0 ? 1.0 : -1.0;

    vec[idx1] += sign1 * 1.5;
    vec[idx2] += sign2 * 1.0;

    // 2. Character n-gram subwords (captures morphologic stems)
    if (token.length > 3) {
      for (let i = 0; i < token.length - 2; i++) {
        const trigram = token.slice(i, i + 3);
        const ht = fnv1a(trigram, 0x27d4eb2d);
        const idxt = ht % VECTOR_DIM;
        const signt = (ht & 0x80000000) === 0 ? 0.6 : -0.6;
        vec[idxt] += signt;
      }
    }
  }

  // 3. Bigram co-occurrence projections
  for (let i = 0; i < tokens.length - 1; i++) {
    const bigram = `${tokens[i]}_${tokens[i + 1]}`;
    const hb = fnv1a(bigram, 0x45d9f3b);
    const idxb = hb % VECTOR_DIM;
    const signb = (hb & 0x80000000) === 0 ? 0.9 : -0.9;
    vec[idxb] += signb;
  }

  // 4. L2 unit normalization
  let norm = 0;
  for (let i = 0; i < VECTOR_DIM; i++) {
    norm += vec[i] * vec[i];
  }
  norm = Math.sqrt(norm);

  if (norm > 1e-9) {
    for (let i = 0; i < VECTOR_DIM; i++) {
      vec[i] /= norm;
    }
  }

  return Array.from(vec);
}

/**
 * Attempts to query Hugging Face Inference API if an API token is present,
 * otherwise falls back cleanly to the local dense projection.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const hfToken = process.env.HF_TOKEN || process.env.HUGGINGFACE_API_KEY;

  if (hfToken) {
    try {
      const response = await fetch(
        "https://api-inference.huggingface.co/pipeline/feature-extraction/sentence-transformers/all-MiniLM-L6-v2",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${hfToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ inputs: [text], options: { wait_for_model: true } }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data) && Array.isArray(data[0]) && data[0].length === VECTOR_DIM) {
          return data[0];
        }
      }
    } catch {
      // Fallback on network or API failure
    }
  }

  return generateLocalDenseEmbedding(text);
}

export async function generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
  return Promise.all(texts.map((t) => generateEmbedding(t)));
}

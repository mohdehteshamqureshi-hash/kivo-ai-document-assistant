import { Groq } from "groq-sdk";
import type { RankedChunk } from "./vectorMath";
import { STOPWORDS, tokenize } from "./vectorMath";

export const DISCLAIMER_TEXT =
  "Note: This answer is generated from uploaded document passages. Verify against the cited pages.";

export const REFUSAL_TEXT =
  "I cannot answer this question based on the provided documents. The retrieved context does not contain sufficient information to address your query.";

export const DEFAULT_GROQ_MODEL = "qwen/qwen3.8-27b";

/**
 * Robustly detects whether a synthesized answer is an insufficient-information refusal.
 * Handles exact matches and diverse LLM refusal phrasing without brittle single-string matching.
 */
export function isRefusal(answer: string, modelUsed?: string): boolean {
  if (!answer) return true;
  if (modelUsed === "kivo-guard-zero-context") return true;

  const lower = answer.toLowerCase().trim();

  if (lower.includes(REFUSAL_TEXT.toLowerCase())) return true;

  const refusalPhrases = [
    "cannot answer this question based on the provided",
    "can not answer this question based on the provided",
    "unable to answer this question based on the provided",
    "not contain sufficient information",
    "does not contain sufficient information",
    "do not contain sufficient information",
    "not contain enough information",
    "does not contain enough information",
    "do not contain enough information",
    "insufficient information to answer",
    "insufficient information to address",
    "provided context does not contain",
    "supplied documents do not contain",
    "supplied document does not contain",
    "supplied document does not",
    "provided documents do not contain",
    "provided document does not contain",
    "provided document does not",
    "retrieved context does not contain",
    "no information provided about",
    "not mentioned in the provided context",
    "not mentioned in the provided documents",
    "not mentioned in the provided document",
    "does not mention",
    "do not mention",
    "not explicitly mention",
    "does not explicitly mention",
    "the supplied documents do not contain",
  ];

  return refusalPhrases.some((phrase) => lower.includes(phrase));
}

/**
 * Checks if the answer contains valid page citations; if not, appends them.
 * Never appends citations to an insufficient-information refusal.
 */
export function ensureCitations(answer: string, rankedChunks: RankedChunk[]): string {
  if (rankedChunks.length === 0) return answer;

  // Do not append citations if the model explicitly issued a refusal
  if (isRefusal(answer)) {
    return answer;
  }

  const citationPattern = /\[[^\]]+,\s*(?:Page|p\.)\s*\d+\]/i;
  if (citationPattern.test(answer)) {
    return answer;
  }

  // Auto-restore citations from top ranked chunks
  const uniqueSources = new Map<string, number>();
  for (const { chunk } of rankedChunks) {
    if (!uniqueSources.has(chunk.doc_name)) {
      uniqueSources.set(chunk.doc_name, chunk.page);
    }
  }

  const citationsList = Array.from(uniqueSources.entries())
    .map(([file, page]) => `[${file}, Page ${page}]`)
    .join(" ");

  return `${answer.trim()}\n\nSources: ${citationsList}`;
}

/**
 * Safe, deterministic extractive support evaluation when LLM API is unavailable.
 *
 * Limitations: Simple token overlap and score floors confirm lexical presence and retrieval strength,
 * but do not perform semantic reasoning or factual inference. This acts as a conservative fail-safe
 * to avoid returning arbitrary retrieved passages as answers when LLM synthesis is offline.
 */
export function evaluateExtractiveSupport(
  question: string,
  topRanked: RankedChunk
): { supported: boolean; answer: string } {
  if (!topRanked || !topRanked.chunk || !topRanked.chunk.text) {
    return { supported: false, answer: REFUSAL_TEXT };
  }

  const queryTokens = tokenize(question).filter(
    (t) => !STOPWORDS.has(t) && t.length > 2
  );
  const targetTokens =
    queryTokens.length > 0
      ? Array.from(new Set(queryTokens))
      : Array.from(new Set(tokenize(question).filter((t) => t.length > 2)));

  if (targetTokens.length === 0) {
    return { supported: false, answer: REFUSAL_TEXT };
  }

  const chunkLower = topRanked.chunk.text.toLowerCase();
  const matchedTokens = targetTokens.filter((token) => chunkLower.includes(token));
  const coverage = matchedTokens.length / targetTokens.length;

  // Safe conservative criteria: score floor >= 0.40 and high keyword coverage
  const scorePasses = topRanked.score >= 0.40;
  const coveragePasses = targetTokens.length <= 2 ? coverage === 1.0 : coverage >= 0.60;

  if (!scorePasses || !coveragePasses) {
    return { supported: false, answer: REFUSAL_TEXT };
  }

  const topChunk = topRanked.chunk;
  const snippet =
    topChunk.text.length > 300 ? `${topChunk.text.slice(0, 300)}...` : topChunk.text;
  const answer = `According to ${topChunk.doc_name} (Page ${topChunk.page}):\n\n"${snippet}" [${topChunk.doc_name}, Page ${topChunk.page}]`;

  return { supported: true, answer };
}

/**
 * Invokes Groq API to synthesize a grounded answer using retrieved document context.
 */
export async function generateGroundedAnswer(
  question: string,
  rankedChunks: RankedChunk[]
): Promise<{ answer: string; modelUsed: string }> {
  // Zero-hallucination guard
  if (rankedChunks.length === 0) {
    return {
      answer: REFUSAL_TEXT,
      modelUsed: "kivo-guard-zero-context",
    };
  }

  const groqApiKey = process.env.GROQ_API_KEY;
  const groqModel = process.env.GROQ_MODEL || DEFAULT_GROQ_MODEL;

  if (!groqApiKey) {
    // Deterministic extractive check: assess whether the top chunk legitimately supports the question
    const support = evaluateExtractiveSupport(question, rankedChunks[0]);
    return {
      answer: support.answer,
      modelUsed: "kivo-extractive-fallback",
    };
  }

  // Format context with strict untrusted data isolation
  const formattedContext = rankedChunks
    .map(
      ({ chunk, score }, idx) =>
        `[Context Passage ${idx + 1}] (Document: ${chunk.doc_name}, Page: ${chunk.page}, Score: ${score.toFixed(2)}):\n${chunk.text}`
    )
    .join("\n\n---\n\n");

  const systemPrompt = `You are Kivo AI, an intelligent, grounded RAG document assistant.
Your answers MUST be strictly based ONLY on the provided retrieved document passages inside <untrusted_retrieved_context>.
Do NOT assume or hallucinate any outside information.
For every factual claim, cite the exact source document and page number in the format: [filename, Page X].
If the retrieved context does not contain enough information to answer the question, state: "${REFUSAL_TEXT}"`;

  const userPrompt = `Retrieved Document Passages:
<untrusted_retrieved_context>
${formattedContext}
</untrusted_retrieved_context>

User Question: ${question}

Provide a direct, factual answer citing exact page numbers:`;

  try {
    const groq = new Groq({ apiKey: groqApiKey });
    const completion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      model: groqModel,
      temperature: 0.1,
      max_tokens: 1024,
    });

    const rawAnswer = completion.choices[0]?.message?.content || REFUSAL_TEXT;
    const finalAnswer = isRefusal(rawAnswer) ? REFUSAL_TEXT : ensureCitations(rawAnswer, rankedChunks);

    return {
      answer: finalAnswer,
      modelUsed: `groq-${groqModel}`,
    };
  } catch (err: unknown) {
    const sdkErrStatus =
      err && typeof err === "object" && "status" in err && typeof (err as { status: unknown }).status === "number"
        ? (err as { status: number }).status
        : undefined;
    const sdkErrCode =
      err && typeof err === "object" && "code" in err && typeof (err as { code: unknown }).code === "string"
        ? (err as { code: string }).code
        : undefined;
    const sdkErrType =
      err && typeof err === "object" && "type" in err && typeof (err as { type: unknown }).type === "string"
        ? (err as { type: string }).type
        : undefined;
    const sdkCategory = sdkErrCode || sdkErrType || "sdk_error";

    console.warn(`[Groq Diagnostic] SDK call failed (status: ${sdkErrStatus ?? "unknown"}, category: ${sdkCategory}). Attempting direct HTTPS fallback.`);

    // Direct HTTPS REST fallback
    try {
      const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${groqApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: groqModel,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.1,
          max_tokens: 1024,
        }),
      });

      if (resp.ok) {
        const data = await resp.json();
        const raw = data.choices?.[0]?.message?.content || REFUSAL_TEXT;
        const finalAnswer = isRefusal(raw) ? REFUSAL_TEXT : ensureCitations(raw, rankedChunks);
        return {
          answer: finalAnswer,
          modelUsed: `groq-${groqModel}`,
        };
      }

      // Safe diagnostic logging for non-successful Groq HTTP response
      let errorCategory = "upstream_http_error";
      try {
        const errJson = await resp.json();
        if (errJson && typeof errJson === "object" && errJson.error) {
          const code = errJson.error.code;
          const type = errJson.error.type;
          errorCategory = (typeof code === "string" && code) || (typeof type === "string" && type) || errorCategory;
        }
      } catch {
        // Response body not JSON or already read
      }
      console.warn(`[Groq Diagnostic] HTTPS fallback failed with HTTP status ${resp.status} (category: ${errorCategory})`);
    } catch (networkErr: unknown) {
      const netMsg = networkErr instanceof Error ? networkErr.name : "NetworkError";
      console.warn(`[Groq Diagnostic] HTTPS fallback network error (category: ${netMsg})`);
    }

    // Safe extractive check on API failure: do not present unrelated passage
    const fallbackSupport = evaluateExtractiveSupport(question, rankedChunks[0]);
    if (!fallbackSupport.supported) {
      return {
        answer: REFUSAL_TEXT,
        modelUsed: "kivo-fallback-error",
      };
    }

    return {
      answer: `Unable to complete Groq API call. Top relevant excerpt:\n\n${fallbackSupport.answer}`,
      modelUsed: "kivo-fallback-error",
    };
  }
}

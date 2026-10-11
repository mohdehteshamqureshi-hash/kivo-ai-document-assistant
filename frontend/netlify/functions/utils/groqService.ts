import { Groq } from "groq-sdk";
import type { RankedChunk } from "./vectorMath";

export const DISCLAIMER_TEXT =
  "Note: This answer is generated from uploaded document passages. Verify against the cited pages.";

export const REFUSAL_TEXT =
  "I cannot answer this question based on the provided documents. The retrieved context does not contain sufficient information to address your query.";

export const DEFAULT_GROQ_MODEL = "qwen/qwen3.8-27b";

/**
 * Checks if the answer contains valid page citations; if not, appends them.
 */
export function ensureCitations(answer: string, rankedChunks: RankedChunk[]): string {
  if (rankedChunks.length === 0) return answer;

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
    // If no key configured, generate extractive grounded synthesis
    const topChunk = rankedChunks[0].chunk;
    const extractiveAnswer = `According to ${topChunk.doc_name} (Page ${topChunk.page}):\n\n"${topChunk.text.slice(0, 300)}..." [${topChunk.doc_name}, Page ${topChunk.page}]`;
    return {
      answer: extractiveAnswer,
      modelUsed: "kivo-extractive-fallback",
    };
  }

  // Format context with strict untrusted data isolation
  const formattedContext = rankedChunks
    .map(
      ({ chunk, score }, idx) =>
        `[Context Passage ${idx + 1}] (Document: ${chunk.doc_name}, Page: ${chunk.page}, Relevance: ${Math.round(score * 100)}%):\n${chunk.text}`
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
    const finalAnswer = ensureCitations(rawAnswer, rankedChunks);

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
        return {
          answer: ensureCitations(raw, rankedChunks),
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

    const top = rankedChunks[0].chunk;
    return {
      answer: `Unable to complete Groq API call. Top relevant excerpt from ${top.doc_name} (Page ${top.page}):\n\n"${top.text.slice(0, 250)}..." [${top.doc_name}, Page ${top.page}]`,
      modelUsed: "kivo-fallback-error",
    };
  }
}

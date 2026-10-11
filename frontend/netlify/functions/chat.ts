import { getAllChunks, initStorage } from "./utils/storage";
import { generateEmbedding } from "./utils/embeddings";
import { rankChunks } from "./utils/vectorMath";
import { generateGroundedAnswer, isRefusal } from "./utils/groqService";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const handler = async (event: any) => {
  initStorage(event);
  const method = (event.httpMethod || "POST").toUpperCase();
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (method === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  if (method !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ detail: "Method not allowed. Use POST." }),
    };
  }

  const totalStart = performance.now();

  try {
    const body = typeof event.body === "string" ? JSON.parse(event.body || "{}") : event.body || {};
    const queryText = (body.query || body.question || "").trim();
    const topK = typeof body.top_k === "number" ? body.top_k : 8;
    const targetDocId = body.doc_id || body.document_id || null;

    if (!queryText) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ detail: "Query text cannot be empty." }),
      };
    }

    // Step 1: Retrieval via Normalized Vector Cosine Similarity
    const retrievalStart = performance.now();
    const queryVector = await generateEmbedding(queryText);

    const targetDocIds = targetDocId ? [targetDocId] : undefined;
    const allChunks = await getAllChunks(targetDocIds, event);

    const rankedChunks = rankChunks(queryVector, allChunks, topK, 0.15, queryText);
    const retrievalTimeMs = Math.round((performance.now() - retrievalStart) * 100) / 100;

    // Build candidate passage objects (diagnostic retrieval results)
    const candidatePassages = rankedChunks.map(({ chunk, score }) => ({
      file: chunk.doc_name,
      page: chunk.page,
      score: Math.round(score * 1000) / 1000,
      snippet: chunk.text.length > 250 ? `${chunk.text.slice(0, 250)}...` : chunk.text,
    }));

    // Step 2: Answer Synthesis with Groq API
    const generationStart = performance.now();
    const { answer, modelUsed } = await generateGroundedAnswer(queryText, rankedChunks);
    const generationTimeMs = Math.round((performance.now() - generationStart) * 100) / 100;
    const totalTimeMs = Math.round((performance.now() - totalStart) * 100) / 100;

    // Determine refusal status
    const isRefusalResponse = isRefusal(answer, modelUsed);
    const answerStatus = isRefusalResponse ? "insufficient_information" : "answered";

    // Verified citations: empty on refusal; populated on answered
    const citations = isRefusalResponse ? [] : candidatePassages;

    // Confidence metric:
    // On insufficient-information refusals or zero context, confidence MUST be 0.0.
    // On answered queries, retrieval score serves as the retrieval match confidence.
    const confidence =
      isRefusalResponse || rankedChunks.length === 0
        ? 0.0
        : Math.round((rankedChunks.reduce((acc, c) => acc + c.score, 0) / rankedChunks.length) * 100) / 100;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        query: queryText,
        answer,
        answer_status: answerStatus,
        citations,
        retrieved_passages: candidatePassages,
        retrieval_time_ms: retrievalTimeMs,
        generation_time_ms: generationTimeMs,
        total_time_ms: totalTimeMs,
        confidence,
        model_used: modelUsed,
      }),
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error executing query.";
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ detail: msg }),
    };
  }
};

import { getStorageDiagnostics } from "./utils/storage";

const startTime = Date.now();

export const handler = async () => {
  const { docCount, chunkCount } = await getStorageDiagnostics();
  const uptime = Math.floor((Date.now() - startTime) / 1000);

  const groqModel = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
  const hasGroq = Boolean(process.env.GROQ_API_KEY);
  const llmMode = hasGroq
    ? `Cloud (Groq ${groqModel})`
    : "Grounded Rule/Extractive Fallback";

  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
    body: JSON.stringify({
      status: "healthy",
      version: "2.1.0",
      documents_count: docCount,
      total_chunks: chunkCount,
      vocabulary_size: 384,
      vector_engine: "Netlify Functions Normalized Vector Space (384-dim)",
      llm_mode: llmMode,
      uptime_seconds: uptime,
    }),
  };
};

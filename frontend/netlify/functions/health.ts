import { getStorageDiagnostics, initStorage } from "./utils/storage";

const startTime = Date.now();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const handler = async (event?: any) => {
  initStorage(event);
  const { isNetlify, storageBackend, docCount, chunkCount } = await getStorageDiagnostics(event);
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
      storage_backend: storageBackend,
      is_persistent: isNetlify,
      documents_count: docCount,
      total_chunks: chunkCount,
      vocabulary_size: 384,
      vector_engine: "Netlify Functions Normalized Vector Space (384-dim)",
      llm_mode: llmMode,
      uptime_seconds: uptime,
    }),
  };
};

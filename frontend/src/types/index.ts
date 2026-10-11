export interface Citation {
  file: string;
  page: number;
  score: number;
  snippet: string;
}

export interface DocumentItem {
  id: string;
  name: string;
  pages: number;
  chunks_count: number;
  size_bytes: number;
  uploaded_at: string;
  status: "ready" | "processing" | "error";
}

export interface QueryResponse {
  query: string;
  answer: string;
  answer_status?: "answered" | "insufficient_information";
  citations: Citation[];
  retrieved_passages?: Citation[];
  retrieval_time_ms: number;
  generation_time_ms: number;
  total_time_ms: number;
  confidence: number;
  model_used: string;
}

export interface HealthStatus {
  status: string;
  version: string;
  documents_count: number;
  total_chunks: number;
  vocabulary_size: number;
  vector_engine: string;
  llm_mode: string;
  uptime_seconds: number;
}

export interface DeleteResponse {
  success: boolean;
  message: string;
  doc_id?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
  citations?: Citation[];
  retrievedPassages?: Citation[];
  answerStatus?: "answered" | "insufficient_information";
  model?: string;
  totalTimeMs?: number;
  retrievalTimeMs?: number;
  confidence?: number;
  timestamp: string;
  isError?: boolean;
}

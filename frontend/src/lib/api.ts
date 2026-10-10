import axios from "axios";

export const API_BASE_URL = "http://127.0.0.1:8000/api";

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
});

export interface DocumentItem {
  id: string;
  name: string;
  pages: number;
  chunks_count: number;
  size_bytes: number;
  uploaded_at: string;
  status: "ready" | "processing" | "error";
}

export interface Citation {
  file: string;
  page: number;
  score: number;
  snippet: string;
}

export interface QueryResponse {
  query: string;
  answer: string;
  citations: Citation[];
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

export const api = {
  async getHealth(): Promise<HealthStatus> {
    const res = await apiClient.get<HealthStatus>("/health");
    return res.data;
  },

  async getDocuments(): Promise<DocumentItem[]> {
    const res = await apiClient.get<DocumentItem[]>("/documents");
    return res.data;
  },

  async uploadDocument(file: File): Promise<DocumentItem> {
    const formData = new FormData();
    formData.append("file", file);
    const res = await apiClient.post<DocumentItem>("/documents/upload", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return res.data;
  },

  async deleteDocument(id: string): Promise<void> {
    await apiClient.delete(`/documents/${id}`);
  },

  async clearAllDocuments(): Promise<void> {
    await apiClient.delete("/documents");
  },

  async query(queryText: string, topK: number = 4): Promise<QueryResponse> {
    const res = await apiClient.post<QueryResponse>("/chat/query", {
      query: queryText,
      top_k: topK,
    });
    return res.data;
  },
};

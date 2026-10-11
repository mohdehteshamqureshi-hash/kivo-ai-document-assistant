import axios, { AxiosError } from "axios";
import type {
  DeleteResponse,
  DocumentItem,
  HealthStatus,
  QueryResponse,
} from "../types";

// Read API URL from Vite environment variables with fallback to relative same-domain /api
export const BACKEND_API_URL: string =
  import.meta.env.VITE_API_URL || "/api";

export const DOCS_URL: string = BACKEND_API_URL.startsWith("http")
  ? BACKEND_API_URL.replace(/\/api\/?$/, "") + "/docs"
  : "/api/health";

const apiClient = axios.create({
  baseURL: BACKEND_API_URL,
  timeout: 30000,
  headers: {
    "Accept": "application/json",
  },
});

export class ApiError extends Error {
  status?: number;
  detail?: string;

  constructor(message: string, status?: number, detail?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

function handleAxiosError(err: unknown, defaultMessage: string): never {
  if (axios.isAxiosError(err)) {
    const axiosErr = err as AxiosError<{ detail?: string; error?: string }>;
    const detail = axiosErr.response?.data?.detail || axiosErr.response?.data?.error;
    const status = axiosErr.response?.status;

    if (axiosErr.code === "ECONNABORTED") {
      throw new ApiError("Request timed out. The backend server took too long to respond.", 408);
    }
    if (!axiosErr.response) {
      throw new ApiError(
        `Backend server is unreachable. Please ensure the backend server is running at ${BACKEND_API_URL}.`,
        0
      );
    }
    throw new ApiError(detail || defaultMessage, status, detail);
  }
  throw new ApiError(defaultMessage);
}

export const ragApi = {
  getBaseUrl(): string {
    return BACKEND_API_URL;
  },

  /**
   * Check backend health and index diagnostics
   */
  async getHealth(): Promise<HealthStatus> {
    try {
      const res = await apiClient.get<HealthStatus>("/health");
      return res.data;
    } catch (err) {
      return handleAxiosError(err, "Failed to connect to backend health endpoint.");
    }
  },

  /**
   * Fetch all indexed documents in the active knowledge base
   */
  async getDocuments(): Promise<DocumentItem[]> {
    try {
      const res = await apiClient.get<DocumentItem[]>("/documents");
      return res.data;
    } catch (err) {
      return handleAxiosError(err, "Failed to load document library.");
    }
  },

  /**
   * Upload a PDF file for page-aware extraction, chunking, and NumPy vector indexing
   */
  async uploadDocument(file: File): Promise<DocumentItem> {
    // Validate file type
    const isPdf = file.name.toLowerCase().endsWith(".pdf") || file.type === "application/pdf";
    const isTxt = file.name.toLowerCase().endsWith(".txt") || file.name.toLowerCase().endsWith(".md");

    if (!isPdf && !isTxt) {
      throw new ApiError("Unsupported file type. Only PDF (recommended) or TXT/MD files are allowed.");
    }

    // Validate size (max 25MB)
    const maxBytes = 25 * 1024 * 1024;
    if (file.size > maxBytes) {
      throw new ApiError("File exceeds maximum allowed size of 25 MB.");
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await apiClient.post<DocumentItem>("/documents/upload", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      return res.data;
    } catch (err) {
      return handleAxiosError(err, "Failed to upload and index document.");
    }
  },

  /**
   * Delete a document and purge its vector embeddings
   */
  async deleteDocument(docId: string): Promise<DeleteResponse> {
    try {
      const res = await apiClient.delete<DeleteResponse>(`/documents/${docId}`);
      return res.data;
    } catch (err) {
      return handleAxiosError(err, `Failed to delete document '${docId}'.`);
    }
  },

  /**
   * Clear the entire active knowledge base
   */
  async clearAllDocuments(): Promise<DeleteResponse> {
    try {
      const res = await apiClient.delete<DeleteResponse>("/documents");
      return res.data;
    } catch (err) {
      return handleAxiosError(err, "Failed to clear knowledge base.");
    }
  },

  /**
   * Perform RAG semantic query with NumPy cosine vector search
   */
  async queryChat(queryText: string, topK: number = 8, docId?: string): Promise<QueryResponse> {
    const trimmed = queryText.trim();
    if (!trimmed) {
      throw new ApiError("Query cannot be empty.");
    }

    try {
      const res = await apiClient.post<QueryResponse>("/chat/query", {
        query: trimmed,
        top_k: topK,
        doc_id: docId || null,
      });
      return res.data;
    } catch (err) {
      return handleAxiosError(err, "Failed to execute RAG query.");
    }
  },
};

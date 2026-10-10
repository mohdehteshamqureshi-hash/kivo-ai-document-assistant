import { getStore } from "@netlify/blobs";

export interface DocumentItem {
  id: string;
  name: string;
  pages: number;
  chunks_count: number;
  size_bytes: number;
  uploaded_at: string;
  status: "ready" | "processing" | "error";
}

export interface Chunk {
  id: string;
  doc_id: string;
  doc_name: string;
  page: number;
  text: string;
  embedding: number[]; // 384-dimensional dense vector
}

// In-memory fallback for local development and offline test suites
const localMemoryStore = {
  documents: new Map<string, DocumentItem>(),
  chunks: new Map<string, Chunk[]>(),
};

function getBlobStores() {
  try {
    const metaStore = getStore({ name: "kivo-metadata", consistency: "strong" });
    const chunksStore = getStore({ name: "kivo-chunks", consistency: "strong" });
    return { metaStore, chunksStore, isNetlify: true };
  } catch {
    // MissingBlobsEnvironmentError in local environment without Netlify CLI
    return { metaStore: null, chunksStore: null, isNetlify: false };
  }
}

export async function listDocuments(): Promise<DocumentItem[]> {
  const { metaStore, isNetlify } = getBlobStores();
  if (isNetlify && metaStore) {
    try {
      const data = await metaStore.get("index", { type: "json" });
      return (data as DocumentItem[]) || [];
    } catch {
      // Fallback if key does not exist yet
      return [];
    }
  }
  return Array.from(localMemoryStore.documents.values()).sort(
    (a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime()
  );
}

export async function saveDocument(doc: DocumentItem, chunks: Chunk[]): Promise<void> {
  const { metaStore, chunksStore, isNetlify } = getBlobStores();

  // Save to memory store
  localMemoryStore.documents.set(doc.id, doc);
  localMemoryStore.chunks.set(doc.id, chunks);

  if (isNetlify && metaStore && chunksStore) {
    try {
      // Update metadata index
      const existing = await listDocuments();
      const updated = [doc, ...existing.filter((d) => d.id !== doc.id)];
      await metaStore.setJSON("index", updated);

      // Save document chunks
      await chunksStore.setJSON(`chunks:${doc.id}`, chunks);
    } catch (err) {
      console.warn("Netlify Blobs save fallback to memory:", err);
    }
  }
}

export async function deleteDocument(docId: string): Promise<boolean> {
  const { metaStore, chunksStore, isNetlify } = getBlobStores();
  const hadDoc = localMemoryStore.documents.has(docId);
  localMemoryStore.documents.delete(docId);
  localMemoryStore.chunks.delete(docId);

  if (isNetlify && metaStore && chunksStore) {
    try {
      const existing = await listDocuments();
      const updated = existing.filter((d) => d.id !== docId);
      await metaStore.setJSON("index", updated);
      await chunksStore.delete(`chunks:${docId}`);
      return true;
    } catch (err) {
      console.warn("Netlify Blobs delete error:", err);
    }
  }
  return hadDoc;
}

export async function clearAllDocuments(): Promise<void> {
  const { metaStore, chunksStore, isNetlify } = getBlobStores();
  localMemoryStore.documents.clear();
  localMemoryStore.chunks.clear();

  if (isNetlify && metaStore && chunksStore) {
    try {
      await metaStore.setJSON("index", []);
      // Blob store keys can be overwritten
    } catch (err) {
      console.warn("Netlify Blobs clear error:", err);
    }
  }
}

export async function getAllChunks(targetDocIds?: string[]): Promise<Chunk[]> {
  const { chunksStore, isNetlify } = getBlobStores();
  const docs = await listDocuments();
  const allowedDocIds = targetDocIds && targetDocIds.length > 0
    ? new Set(targetDocIds)
    : null;

  const relevantDocs = allowedDocIds
    ? docs.filter((d) => allowedDocIds.has(d.id))
    : docs;

  const allChunks: Chunk[] = [];

  for (const doc of relevantDocs) {
    if (isNetlify && chunksStore) {
      try {
        const docChunks = await chunksStore.get(`chunks:${doc.id}`, { type: "json" });
        if (Array.isArray(docChunks)) {
          allChunks.push(...(docChunks as Chunk[]));
          continue;
        }
      } catch {
        // Fall back to memory check
      }
    }
    const memChunks = localMemoryStore.chunks.get(doc.id);
    if (memChunks) {
      allChunks.push(...memChunks);
    }
  }

  return allChunks;
}

export async function getStorageDiagnostics() {
  const docs = await listDocuments();
  const chunks = await getAllChunks();
  return {
    docCount: docs.length,
    chunkCount: chunks.length,
  };
}

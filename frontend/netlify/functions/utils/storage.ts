import { connectLambda, getStore } from "@netlify/blobs";

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

/**
 * Initializes Netlify Blobs execution environment in Lambda compatibility mode.
 * Must be called at the start of any Netlify Function handler with the event object.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function initStorage(event?: any): boolean {
  if (event && event.blobs) {
    try {
      connectLambda(event);
      return true;
    } catch (err) {
      console.warn("Netlify Blobs connectLambda failed:", err);
      return false;
    }
  }
  return false;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getBlobStores(event?: any) {
  if (event) {
    initStorage(event);
  }
  try {
    const metaStore = getStore({ name: "kivo-metadata" });
    const chunksStore = getStore({ name: "kivo-chunks" });
    return { metaStore, chunksStore, isNetlify: true, error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    // MissingBlobsEnvironmentError in local environment without Netlify CLI / Blobs context
    return { metaStore: null, chunksStore: null, isNetlify: false, error: msg };
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function listDocuments(event?: any): Promise<DocumentItem[]> {
  const { metaStore, isNetlify, error } = getBlobStores(event);
  if (isNetlify && metaStore) {
    try {
      const data = await metaStore.get("index", { type: "json" });
      return (data as DocumentItem[]) || [];
    } catch (err) {
      console.warn("Netlify Blobs listDocuments read error, falling back to empty:", err);
      return [];
    }
  }
  if (error) {
    // Expected in offline test suites without Blobs context
  }
  return Array.from(localMemoryStore.documents.values()).sort(
    (a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime()
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function saveDocument(doc: DocumentItem, chunks: Chunk[], event?: any): Promise<void> {
  const { metaStore, chunksStore, isNetlify, error } = getBlobStores(event);

  // Save to memory store
  localMemoryStore.documents.set(doc.id, doc);
  localMemoryStore.chunks.set(doc.id, chunks);

  if (isNetlify && metaStore && chunksStore) {
    try {
      // Update metadata index
      const existing = await listDocuments(event);
      const updated = [doc, ...existing.filter((d) => d.id !== doc.id)];
      await metaStore.setJSON("index", updated);

      // Save document chunks
      await chunksStore.setJSON(`chunks:${doc.id}`, chunks);
    } catch (err) {
      console.warn("Netlify Blobs save error:", err);
    }
  } else {
    console.warn(`Netlify Blobs inactive (${error || "MissingBlobsEnvironment"}). Document '${doc.id}' saved to in-memory store only.`);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function deleteDocument(docId: string, event?: any): Promise<boolean> {
  const { metaStore, chunksStore, isNetlify } = getBlobStores(event);
  const hadDoc = localMemoryStore.documents.has(docId);
  localMemoryStore.documents.delete(docId);
  localMemoryStore.chunks.delete(docId);

  if (isNetlify && metaStore && chunksStore) {
    try {
      const existing = await listDocuments(event);
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function clearAllDocuments(event?: any): Promise<void> {
  const { metaStore, chunksStore, isNetlify } = getBlobStores(event);
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getAllChunks(targetDocIds?: string[], event?: any): Promise<Chunk[]> {
  const { chunksStore, isNetlify } = getBlobStores(event);
  const docs = await listDocuments(event);
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
      } catch (err) {
        console.warn(`Netlify Blobs read chunks error for doc '${doc.id}':`, err);
      }
    }
    const memChunks = localMemoryStore.chunks.get(doc.id);
    if (memChunks) {
      allChunks.push(...memChunks);
    }
  }

  return allChunks;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getStorageDiagnostics(event?: any) {
  const { isNetlify, error } = getBlobStores(event);
  const docs = await listDocuments(event);
  const chunks = await getAllChunks(undefined, event);
  return {
    isNetlify,
    storageBackend: isNetlify ? "Netlify Blobs (Persistent)" : "In-Memory Map (Ephemeral Fallback)",
    error: error || null,
    docCount: docs.length,
    chunkCount: chunks.length,
  };
}

/**
 * Testing helper: clears in-memory maps to simulate cross-container or cold-start isolation.
 */
export function _resetLocalMemoryStoreForTesting(): void {
  localMemoryStore.documents.clear();
  localMemoryStore.chunks.clear();
}

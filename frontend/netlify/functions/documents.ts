import busboy from "busboy";
import {
  listDocuments,
  saveDocument,
  deleteDocument,
  clearAllDocuments,
  initStorage,
  type DocumentItem,
  type Chunk,
} from "./utils/storage";
import { extractPdfPages, chunkPages } from "./utils/pdfParser";
import { generateBatchEmbeddings } from "./utils/embeddings";

interface UploadedFile {
  filename: string;
  buffer: Buffer;
}

function parseMultipart(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  event: any
): Promise<UploadedFile> {
  return new Promise((resolve, reject) => {
    const contentType =
      event.headers["content-type"] ||
      event.headers["Content-Type"] ||
      "";

    // Fallback: If sent as JSON with base64 payload (e.g. testing)
    if (contentType.includes("application/json") && event.body) {
      try {
        const parsed = JSON.parse(event.body);
        if (typeof parsed.fileBase64 === "string") {
          return resolve({
            filename: parsed.filename || "uploaded_document.pdf",
            buffer: parsed.fileBase64 ? Buffer.from(parsed.fileBase64, "base64") : Buffer.alloc(0),
          });
        }
      } catch {
        // Fall through
      }
    }

    if (!contentType.includes("multipart/form-data")) {
      // If raw binary
      const bodyBuf = event.isBase64Encoded
        ? Buffer.from(event.body || "", "base64")
        : Buffer.from(event.body || "", "utf-8");
      return resolve({
        filename: "uploaded_document.pdf",
        buffer: bodyBuf,
      });
    }

    const bb = busboy({
      headers: { "content-type": contentType },
      limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB max
    });

    let fileBuffer: Buffer | null = null;
    let fileName = "uploaded_document.pdf";

    bb.on("file", (_name, file, info) => {
      fileName = info.filename || fileName;
      const chunks: Buffer[] = [];
      file.on("data", (d) => chunks.push(d));
      file.on("end", () => {
        fileBuffer = Buffer.concat(chunks);
      });
    });

    bb.on("close", () => {
      if (fileBuffer && fileBuffer.length > 0) {
        resolve({ filename: fileName, buffer: fileBuffer });
      } else {
        reject(new Error("No file content received."));
      }
    });

    bb.on("error", (err) => reject(err));

    const bodyBuffer = event.isBase64Encoded
      ? Buffer.from(event.body || "", "base64")
      : Buffer.from(event.body || "", "utf-8");

    bb.end(bodyBuffer);
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const handler = async (event: any) => {
  initStorage(event);
  const method = (event.httpMethod || "GET").toUpperCase();
  const path = event.path || "";
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (method === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  // 1. GET /documents — List all indexed documents
  if (method === "GET") {
    const docs = await listDocuments(event);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(docs),
    };
  }

  // 2. POST /documents/upload or POST /documents — Upload & index PDF
  if (method === "POST") {
    try {
      const { filename, buffer } = await parseMultipart(event);

      if (!filename.toLowerCase().endsWith(".pdf") && !filename.toLowerCase().endsWith(".txt")) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            detail: "Invalid file format. Only PDF files are supported for page-level extraction.",
          }),
        };
      }

      if (buffer.length === 0) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ detail: "The uploaded file is empty (0 bytes)." }),
        };
      }

      const docId = `doc_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;

      // Step 1: Extract pages
      const pages = await extractPdfPages(buffer);
      const totalPages = Math.max(1, pages.length);

      // Step 2: Sliding-window chunking
      const rawChunks = chunkPages(pages, docId, filename, 350, 50);

      if (rawChunks.length === 0) {
        return {
          statusCode: 422,
          headers,
          body: JSON.stringify({
            detail: "Could not extract any readable text from the document.",
          }),
        };
      }

      // Step 3: Vector Embeddings
      const texts = rawChunks.map((c) => c.text);
      const embeddings = await generateBatchEmbeddings(texts);

      const chunks: Chunk[] = rawChunks.map((raw, idx) => ({
        ...raw,
        embedding: embeddings[idx],
      }));

      // Step 4: Persist Document and Chunks
      const docMeta: DocumentItem = {
        id: docId,
        name: filename,
        pages: totalPages,
        chunks_count: chunks.length,
        size_bytes: buffer.length,
        uploaded_at: new Date().toISOString(),
        status: "ready",
      };

      await saveDocument(docMeta, chunks, event);

      return {
        statusCode: 201,
        headers,
        body: JSON.stringify(docMeta),
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Upload processing failed.";
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ detail: msg }),
      };
    }
  }

  // 3. DELETE /documents/:id or DELETE /documents
  if (method === "DELETE") {
    // Extract doc_id from path or query params
    const queryDocId = event.queryStringParameters?.id;
    const pathParts = path.split("/").filter(Boolean);
    const lastPart = pathParts[pathParts.length - 1];
    const docId = queryDocId || (lastPart !== "documents" ? lastPart : null);

    if (docId) {
      const deleted = await deleteDocument(docId, event);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: deleted,
          message: deleted ? `Document '${docId}' deleted successfully.` : "Document not found.",
          doc_id: docId,
        }),
      };
    }

    // Clear all documents
    await clearAllDocuments(event);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: "All documents cleared from knowledge base.",
      }),
    };
  }

  return {
    statusCode: 405,
    headers,
    body: JSON.stringify({ detail: "Method not allowed." }),
  };
};

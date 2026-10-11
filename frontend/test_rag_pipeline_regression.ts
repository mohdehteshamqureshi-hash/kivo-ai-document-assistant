/**
 * Regression Test: Cross-Handler Netlify Blobs Persistence and RAG Retrieval.
 *
 * Verifies that:
 * 1. Netlify Blobs initializes properly in Lambda mode via `connectLambda(event)`.
 * 2. Documents uploaded via `documents.ts` persist in Netlify Blobs.
 * 3. `chat.ts` running in an isolated container context (with empty in-memory store)
 *    successfully retrieves chunks from Netlify Blobs across function boundaries.
 * 4. Multi-page PDF text and page coordinates (Page 1, Page 2) are accurately cited.
 * 5. `model_used` is not `kivo-guard-zero-context` when matching chunks exist.
 * 6. Deletion cleans up only the test document from Blobs storage.
 */

import http from "http";
import { handler as documentsHandler } from "./netlify/functions/documents";
import { handler as chatHandler } from "./netlify/functions/chat";
import { _resetLocalMemoryStoreForTesting } from "./netlify/functions/utils/storage";
import { generateGroundedAnswer, DEFAULT_GROQ_MODEL } from "./netlify/functions/utils/groqService";

async function runRegressionSuite() {
  console.log("======================================================================");
  console.log("  RUNNING CROSS-HANDLER NETLIFY BLOBS RAG REGRESSION TEST");
  console.log("======================================================================");

  // 1. Spin up a lightweight local mock Netlify Blobs server
  const blobDataStore = new Map<string, string>();

  const server = http.createServer((req, res) => {
    const url = new URL(req.url || "/", `http://${req.headers.host}`);
    const key = decodeURIComponent(url.pathname);

    if (req.method === "PUT") {
      let body = "";
      req.on("data", (chunk) => {
        body += chunk;
      });
      req.on("end", () => {
        blobDataStore.set(key, body);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ modified: true }));
      });
      return;
    }

    if (req.method === "GET") {
      if (blobDataStore.has(key)) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(blobDataStore.get(key));
      } else {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Not found" }));
      }
      return;
    }

    if (req.method === "DELETE") {
      blobDataStore.delete(key);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ deleted: true }));
      return;
    }

    res.writeHead(405, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Method not allowed" }));
  });

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });

  const address = server.address() as { port: number };
  const mockPort = address.port;
  console.log(`Step 1: Mock Netlify Blobs server active on port ${mockPort}.`);

  const mockBlobsPayload = Buffer.from(
    JSON.stringify({ url: `http://127.0.0.1:${mockPort}`, token: "test-token" })
  ).toString("base64");

  const commonHeaders = {
    "x-nf-site-id": "site_regression_test",
    "x-nf-deploy-id": "deploy_regression_test",
    "content-type": "application/json",
  };

  try {
    // 2. Synthesize a valid 2-page PDF with distinct factual content per page
    console.log("Step 2: Creating valid 2-page binary PDF with distinct page contents...");
    const page1Fact = "Photonics Research Page 1: Quantum optical waveguides achieve 99.4% transmission fidelity.";
    const page2Fact = "Photonics Research Page 2: Thermal noise suppression operates at -269 Celsius.";

    const pdfSource =
      "%PDF-1.4\n" +
      "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n" +
      "2 0 obj\n<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>\nendobj\n" +
      "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 5 0 R /Resources << /Font << /F1 7 0 R >> >> >>\nendobj\n" +
      "4 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 6 0 R /Resources << /Font << /F1 7 0 R >> >> >>\nendobj\n" +
      "5 0 obj\n<< /Length " + (page1Fact.length + 20) + " >>\nstream\nBT\n/F1 12 Tf\n72 700 Td\n(" + page1Fact + ") Tj\nET\nendstream\nendobj\n" +
      "6 0 obj\n<< /Length " + (page2Fact.length + 20) + " >>\nstream\nBT\n/F1 12 Tf\n72 700 Td\n(" + page2Fact + ") Tj\nET\nendstream\nendobj\n" +
      "7 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n" +
      "xref\n0 8\n0000000000 65535 f \n" +
      "trailer\n<< /Size 8 /Root 1 0 R >>\nstartxref\n0\n%%EOF\n";

    const uploadEvent = {
      httpMethod: "POST",
      path: "/.netlify/functions/documents",
      headers: commonHeaders,
      blobs: mockBlobsPayload,
      body: JSON.stringify({
        filename: "photonics_guide.pdf",
        fileBase64: Buffer.from(pdfSource, "utf-8").toString("base64"),
      }),
    };

    console.log("Step 3: Uploading 2-page PDF via documents handler with Blobs context...");
    const uploadRes = await documentsHandler(uploadEvent);
    if (uploadRes.statusCode !== 201) {
      throw new Error(`Upload failed with status ${uploadRes.statusCode}: ${uploadRes.body}`);
    }
    const uploadedDoc = JSON.parse(uploadRes.body);
    console.log(`✅ Upload OK: DocID=${uploadedDoc.id}, Pages=${uploadedDoc.pages}, Chunks=${uploadedDoc.chunks_count}`);

    if (uploadedDoc.pages !== 2 || uploadedDoc.chunks_count !== 2) {
      throw new Error(`Expected 2 pages and 2 chunks, got pages=${uploadedDoc.pages}, chunks=${uploadedDoc.chunks_count}`);
    }

    // 3. Reset in-memory Map store to simulate cross-container cold start
    console.log("Step 4: Wiping local in-memory storage to simulate cold-start / separate container...");
    _resetLocalMemoryStoreForTesting();

    // 4. Query chat handler for Page 1 fact across container boundary
    console.log("Step 5: Invoking chat handler querying Page 1 fact (cross-handler Blobs retrieval)...");
    const queryP1Event = {
      httpMethod: "POST",
      path: "/.netlify/functions/chat",
      headers: commonHeaders,
      blobs: mockBlobsPayload,
      body: JSON.stringify({
        query: "What is the transmission fidelity of quantum optical waveguides?",
        doc_id: uploadedDoc.id,
      }),
    };

    const chatP1Res = await chatHandler(queryP1Event);
    if (chatP1Res.statusCode !== 200) {
      throw new Error(`Chat query for Page 1 returned HTTP ${chatP1Res.statusCode}: ${chatP1Res.body}`);
    }
    const chatP1Data = JSON.parse(chatP1Res.body);

    console.log(`✅ Chat Page 1 Response: Citations=${chatP1Data.citations?.length}, Model=${chatP1Data.model_used}`);
    if (!chatP1Data.citations || chatP1Data.citations.length === 0) {
      throw new Error("FAIL: Zero citations returned for Page 1 query!");
    }
    const topCitationP1 = chatP1Data.citations[0];
    if (topCitationP1.page !== 1) {
      throw new Error(`FAIL: Expected citation for Page 1, got page ${topCitationP1.page}`);
    }
    if (topCitationP1.score < 0.15) {
      throw new Error(`FAIL: Similarity score ${topCitationP1.score} is below threshold 0.15`);
    }
    if (chatP1Data.model_used === "kivo-guard-zero-context") {
      throw new Error("FAIL: Model used is kivo-guard-zero-context despite valid document chunks!");
    }
    console.log(`✅ Verified: Retrieved Page 1 citation with score=${topCitationP1.score}, file='${topCitationP1.file}', page=${topCitationP1.page}`);

    // 5. Query chat handler for Page 2 fact
    console.log("Step 6: Invoking chat handler querying Page 2 fact...");
    const queryP2Event = {
      httpMethod: "POST",
      path: "/.netlify/functions/chat",
      headers: commonHeaders,
      blobs: mockBlobsPayload,
      body: JSON.stringify({
        query: "At what temperature does thermal noise suppression operate?",
      }),
    };

    const chatP2Res = await chatHandler(queryP2Event);
    if (chatP2Res.statusCode !== 200) {
      throw new Error(`Chat query for Page 2 returned HTTP ${chatP2Res.statusCode}: ${chatP2Res.body}`);
    }
    const chatP2Data = JSON.parse(chatP2Res.body);

    if (!chatP2Data.citations || chatP2Data.citations.length === 0) {
      throw new Error("FAIL: Zero citations returned for Page 2 query!");
    }
    const topCitationP2 = chatP2Data.citations[0];
    if (topCitationP2.page !== 2) {
      throw new Error(`FAIL: Expected citation for Page 2, got page ${topCitationP2.page}`);
    }
    console.log(`✅ Verified: Retrieved Page 2 citation with score=${topCitationP2.score}, file='${topCitationP2.file}', page=${topCitationP2.page}`);

    // 6. Test document cleanup
    console.log("Step 7: Purging test document from Netlify Blobs storage...");
    const deleteEvent = {
      httpMethod: "DELETE",
      path: `/.netlify/functions/documents/${uploadedDoc.id}`,
      queryStringParameters: { id: uploadedDoc.id },
      headers: commonHeaders,
      blobs: mockBlobsPayload,
    };
    const deleteRes = await documentsHandler(deleteEvent);
    if (deleteRes.statusCode !== 200) {
      throw new Error(`Delete failed with status ${deleteRes.statusCode}: ${deleteRes.body}`);
    }
    console.log(`✅ Document '${uploadedDoc.id}' deleted successfully.`);

    // 7. Verify post-deletion retrieval returns 0 citations (zero-context guard properly fires)
    console.log("Step 8: Verifying post-deletion queries safely trigger zero-context guard...");
    _resetLocalMemoryStoreForTesting();
    const postDeleteChatRes = await chatHandler(queryP1Event);
    const postDeleteData = JSON.parse(postDeleteChatRes.body);
    if (postDeleteData.citations?.length !== 0 || postDeleteData.model_used !== "kivo-guard-zero-context") {
      throw new Error(`FAIL: Expected 0 citations and kivo-guard-zero-context after deletion, got model=${postDeleteData.model_used}`);
    }
    console.log("✅ Verified: Zero-hallucination guard triggers safely when no documents exist.");

    // 8. Verify default GROQ_MODEL fallback is qwen/qwen3.8-27b when GROQ_MODEL is unset
    console.log("Step 9: Verifying default GROQ_MODEL fallback when unset is qwen/qwen3.8-27b...");
    delete process.env.GROQ_MODEL;
    if (DEFAULT_GROQ_MODEL !== "qwen/qwen3.8-27b") {
      throw new Error(`FAIL: Expected DEFAULT_GROQ_MODEL to be 'qwen/qwen3.8-27b', got '${DEFAULT_GROQ_MODEL}'`);
    }

    const mockChunk = {
      score: 0.92,
      chunk: {
        id: "chunk_mock_1",
        doc_id: "doc_mock",
        doc_name: "photonics_guide.pdf",
        page: 1,
        text: "Quantum optical waveguides achieve 99.4% transmission fidelity.",
        embedding: [],
      },
    };

    const origFetch = globalThis.fetch;
    let invokedModel = "";
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = input.toString();
      if (url.includes("api.groq.com")) {
        try {
          const body = JSON.parse((init?.body as string) || "{}");
          invokedModel = body.model;
        } catch {
          // ignore
        }
        return new Response(
          JSON.stringify({
            choices: [{ message: { content: "Transmission fidelity is 99.4% [photonics_guide.pdf, Page 1]." } }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return origFetch(input, init);
    };

    try {
      process.env.GROQ_API_KEY = "mock_gsk_test_key_for_regression";
      delete process.env.GROQ_MODEL;
      const groundedRes = await generateGroundedAnswer("What is the transmission fidelity?", [mockChunk]);
      if (groundedRes.modelUsed !== "groq-qwen/qwen3.8-27b") {
        throw new Error(`FAIL: Expected modelUsed to be 'groq-qwen/qwen3.8-27b', got '${groundedRes.modelUsed}'`);
      }
      if (invokedModel !== "qwen/qwen3.8-27b") {
        throw new Error(`FAIL: Expected upstream model parameter to be 'qwen/qwen3.8-27b', got '${invokedModel}'`);
      }
      console.log(`✅ Verified: Default model is 'qwen/qwen3.8-27b' when GROQ_MODEL is unset (modelUsed='${groundedRes.modelUsed}', upstream='${invokedModel}').`);
    } finally {
      globalThis.fetch = origFetch;
      delete process.env.GROQ_API_KEY;
    }

    console.log("======================================================================");
    console.log("🎉 CROSS-HANDLER RAG STORAGE REGRESSION TEST PASSED WITH 100% SUCCESS!");
    console.log("======================================================================");
  } finally {
    server.close();
  }
}

runRegressionSuite().catch((err) => {
  console.error("❌ Regression test failed:", err);
  process.exit(1);
});

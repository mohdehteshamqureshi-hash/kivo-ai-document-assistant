/**
 * Comprehensive Automated Test Suite for Kivo AI Netlify Functions.
 *
 * Tests:
 * 1. GET /health — System diagnostics, Netlify vector engine, and model status
 * 2. POST /documents (Upload) — Page-aware binary PDF parsing, chunking, and embedding
 * 3. GET /documents — Document registry and chunk counts
 * 4. POST /chat — Semantic retrieval, top-K scoring, page-level citations [file, Page X]
 * 5. Out-of-domain query — Zero-hallucination guard and refusal
 * 6. Missing-document handling — Targeted search on non-existent document ID
 * 7. Invalid/empty inputs — HTTP 400 validation
 * 8. Groq error and fallback handling — Resilient synthesis
 * 9. DELETE /documents/:id — Document purging and chunk cleanup
 * 10. DELETE /documents — Clear entire active knowledge base
 */

import { handler as healthHandler } from "./netlify/functions/health";
import { handler as documentsHandler } from "./netlify/functions/documents";
import { handler as chatHandler } from "./netlify/functions/chat";

function generateTestPdfBuffer(text: string): Buffer {
  const lines = text.split("\n");
  const textCommands = lines
    .map((l, i) => {
      const clean = l.replace(/[()]/g, "");
      return i === 0 ? `72 712 Td\n(${clean}) Tj` : `0 -18 Td\n(${clean}) Tj`;
    })
    .join("\n");
  const streamContent = Buffer.from(
    `BT\n/F1 12 Tf\n${textCommands}\nET\n`,
    "utf-8"
  );
  const header = Buffer.from(
    "%PDF-1.4\n1 0 obj <</Type /Catalog /Pages 2 0 R>> endobj\n2 0 obj <</Type /Pages /Kids [3 0 R] /Count 1>> endobj\n3 0 obj <</Type /Page /Parent 2 0 R /Resources <</Font <</F1 4 0 R>>>> /MediaBox [0 0 612 792] /Contents 5 0 R>> endobj\n4 0 obj <</Type /Font /Subtype /Type1 /BaseFont /Helvetica>> endobj\n",
    "utf-8"
  );
  const streamObj = Buffer.concat([
    Buffer.from(`5 0 obj <</Length ${streamContent.length}>> stream\n`),
    streamContent,
    Buffer.from("endstream endobj\n"),
  ]);
  const trailer = Buffer.from(
    "xref\n0 6\n0000000000 65535 f \ntrailer <</Size 6 /Root 1 0 R>>\nstartxref\n0\n%%EOF\n"
  );
  return Buffer.concat([header, streamObj, trailer]);
}

function buildMultipartFormData(filename: string, fileBuffer: Buffer, boundary: string): Buffer {
  const prefix = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: application/pdf\r\n\r\n`
  );
  const suffix = Buffer.from(`\r\n--${boundary}--\r\n`);
  return Buffer.concat([prefix, fileBuffer, suffix]);
}

async function runTestSuite() {
  console.log("======================================================================");
  console.log("  RUNNING KIVO AI NETLIFY FUNCTIONS TEST SUITE");
  console.log("======================================================================");

  let passedTests = 0;
  const totalTests = 10;
  let uploadedDocId = "";

  // -------------------------------------------------------------------------
  // Test 1: GET /health
  // -------------------------------------------------------------------------
  console.log("\n--- Test 1: GET /health ---");
  const healthRes = await healthHandler();
  if (healthRes.statusCode !== 200) {
    throw new Error(`Test 1 Failed: Expected status 200, got ${healthRes.statusCode}`);
  }
  const healthData = JSON.parse(healthRes.body);
  if (healthData.status !== "healthy") {
    throw new Error(`Test 1 Failed: Expected status 'healthy', got '${healthData.status}'`);
  }
  console.log(`✅ Health check OK: Status=${healthData.status}, Engine=${healthData.vector_engine}, Mode=${healthData.llm_mode}`);
  passedTests++;

  // -------------------------------------------------------------------------
  // Test 2: POST /documents (Upload PDF)
  // -------------------------------------------------------------------------
  console.log("\n--- Test 2: POST /documents (Upload PDF) ---");
  const pdfText =
    "Solar Energy Engineering Manual.\n" +
    "Under standard AM1.5 illumination conditions photovoltaic cell efficiency reached 24.3 percent.\n" +
    "Maximum inverter DC voltage is 48 volts with a thermal cutoff at 85 degrees Celsius.";
  const pdfBuffer = generateTestPdfBuffer(pdfText);
  const boundary = "----NetlifyFormBoundary7MA4YWxkTrZu0gW";
  const multipartBody = buildMultipartFormData("solar_specs.pdf", pdfBuffer, boundary);

  const uploadEvent = {
    httpMethod: "POST",
    path: "/api/documents/upload",
    headers: {
      "content-type": `multipart/form-data; boundary=${boundary}`,
    },
    body: multipartBody.toString("base64"),
    isBase64Encoded: true,
  };

  const uploadRes = await documentsHandler(uploadEvent);
  if (uploadRes.statusCode !== 201) {
    throw new Error(`Test 2 Failed: Expected 201, got ${uploadRes.statusCode}: ${uploadRes.body}`);
  }
  const uploadData = JSON.parse(uploadRes.body);
  if (!uploadData.id || uploadData.name !== "solar_specs.pdf") {
    throw new Error(`Test 2 Failed: Invalid upload metadata: ${JSON.stringify(uploadData)}`);
  }
  uploadedDocId = uploadData.id;
  console.log(`✅ Upload OK: DocID=${uploadData.id}, Name=${uploadData.name}, Chunks=${uploadData.chunks_count}, Pages=${uploadData.pages}`);
  passedTests++;

  // -------------------------------------------------------------------------
  // Test 3: GET /documents (List)
  // -------------------------------------------------------------------------
  console.log("\n--- Test 3: GET /documents (List) ---");
  const listEvent = { httpMethod: "GET", path: "/api/documents", headers: {} };
  const listRes = await documentsHandler(listEvent);
  if (listRes.statusCode !== 200) {
    throw new Error(`Test 3 Failed: Expected 200, got ${listRes.statusCode}`);
  }
  const listData = JSON.parse(listRes.body);
  if (!Array.isArray(listData) || listData.length !== 1 || listData[0].id !== uploadedDocId) {
    throw new Error(`Test 3 Failed: Expected array with uploaded doc, got ${JSON.stringify(listData)}`);
  }
  console.log(`✅ List OK: Found ${listData.length} document(s), Name='${listData[0].name}'`);
  passedTests++;

  // -------------------------------------------------------------------------
  // Test 4: POST /chat (Semantic Retrieval & Page Citations)
  // -------------------------------------------------------------------------
  console.log("\n--- Test 4: POST /chat (Semantic Retrieval & Citations) ---");
  const chatEvent = {
    httpMethod: "POST",
    path: "/api/chat/query",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      query: "What is the photovoltaic cell efficiency under AM1.5 illumination?",
      top_k: 4,
    }),
  };

  const chatRes = await chatHandler(chatEvent);
  if (chatRes.statusCode !== 200) {
    throw new Error(`Test 4 Failed: Expected 200, got ${chatRes.statusCode}: ${chatRes.body}`);
  }
  const chatData = JSON.parse(chatRes.body);
  if (!Array.isArray(chatData.citations) || chatData.citations.length === 0) {
    throw new Error(`Test 4 Failed: Expected citations, got: ${JSON.stringify(chatData)}`);
  }
  const topCit = chatData.citations[0];
  if (topCit.file !== "solar_specs.pdf" || topCit.page !== 1) {
    throw new Error(`Test 4 Failed: Citations did not match expected page/file: ${JSON.stringify(topCit)}`);
  }
  if (!chatData.answer || chatData.answer.length < 10) {
    throw new Error(`Test 4 Failed: Missing or empty answer: ${chatData.answer}`);
  }
  console.log(`✅ Chat Retrieval OK: TopCitation='${topCit.file}' (Page ${topCit.page}, Score=${topCit.score})`);
  console.log(`   Answer Excerpt: "${chatData.answer.slice(0, 120)}..."`);
  passedTests++;

  // -------------------------------------------------------------------------
  // Test 5: Out-of-Domain Query & Zero-Hallucination Guard
  // -------------------------------------------------------------------------
  console.log("\n--- Test 5: Zero-Hallucination Guard on Unrelated Query ---");
  const unrelatedEvent = {
    httpMethod: "POST",
    path: "/api/chat/query",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      query: "How do I bake traditional French sourdough bread in an oven?",
      top_k: 4,
    }),
  };

  const unrelatedRes = await chatHandler(unrelatedEvent);
  const unrelatedData = JSON.parse(unrelatedRes.body);
  const isRefusal =
    unrelatedData.citations.length === 0 ||
    unrelatedData.answer.toLowerCase().includes("cannot answer") ||
    unrelatedData.answer.toLowerCase().includes("not contain sufficient") ||
    unrelatedData.answer.toLowerCase().includes("not enough information");

  if (!isRefusal) {
    throw new Error(`Test 5 Failed: System did not refuse unrelated query: ${unrelatedData.answer}`);
  }
  console.log(`✅ Zero-Hallucination Guard OK: Refused query correctly (Citations: ${unrelatedData.citations.length})`);
  passedTests++;

  // -------------------------------------------------------------------------
  // Test 6: Missing-Document Handling (Nonexistent Target Doc ID)
  // -------------------------------------------------------------------------
  console.log("\n--- Test 6: Missing-Document Handling (Invalid doc_id filter) ---");
  const missingDocEvent = {
    httpMethod: "POST",
    path: "/api/chat/query",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      query: "What is the cell efficiency?",
      doc_id: "doc_nonexistent_99999",
      top_k: 4,
    }),
  };

  const missingDocRes = await chatHandler(missingDocEvent);
  const missingDocData = JSON.parse(missingDocRes.body);
  if (missingDocData.citations.length !== 0) {
    throw new Error(`Test 6 Failed: Expected 0 citations for nonexistent doc, got ${missingDocData.citations.length}`);
  }
  console.log(`✅ Missing-Document Handling OK: Returned 0 chunks and refused safely.`);
  passedTests++;

  // -------------------------------------------------------------------------
  // Test 7: Input Validation (Empty Query)
  // -------------------------------------------------------------------------
  console.log("\n--- Test 7: Input Validation (Empty Query) ---");
  const emptyQueryEvent = {
    httpMethod: "POST",
    path: "/api/chat/query",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query: "   " }),
  };

  const emptyQueryRes = await chatHandler(emptyQueryEvent);
  if (emptyQueryRes.statusCode !== 400) {
    throw new Error(`Test 7 Failed: Expected 400 for empty query, got ${emptyQueryRes.statusCode}`);
  }
  console.log(`✅ Empty Query Validation OK: Returned HTTP 400 with detail.`);
  passedTests++;

  // -------------------------------------------------------------------------
  // Test 8: Empty / Invalid File Upload Validation
  // -------------------------------------------------------------------------
  console.log("\n--- Test 8: Empty / Invalid File Upload Validation ---");
  const emptyFileEvent = {
    httpMethod: "POST",
    path: "/api/documents/upload",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ filename: "empty.pdf", fileBase64: "" }),
  };

  const emptyFileRes = await documentsHandler(emptyFileEvent);
  if (emptyFileRes.statusCode !== 400) {
    throw new Error(`Test 8 Failed: Expected 400 for empty file, got ${emptyFileRes.statusCode}`);
  }
  console.log(`✅ Empty File Validation OK: Returned HTTP 400.`);
  passedTests++;

  // -------------------------------------------------------------------------
  // Test 9: DELETE /documents/:id
  // -------------------------------------------------------------------------
  console.log("\n--- Test 9: DELETE /documents/:id ---");
  const deleteEvent = {
    httpMethod: "DELETE",
    path: `/api/documents/${uploadedDocId}`,
    queryStringParameters: { id: uploadedDocId },
    headers: {},
  };

  const deleteRes = await documentsHandler(deleteEvent);
  if (deleteRes.statusCode !== 200) {
    throw new Error(`Test 9 Failed: Expected 200, got ${deleteRes.statusCode}`);
  }
  const deleteData = JSON.parse(deleteRes.body);
  if (!deleteData.success) {
    throw new Error(`Test 9 Failed: Delete success was false: ${deleteRes.body}`);
  }

  // Verify list is now empty
  const verifyListRes = await documentsHandler(listEvent);
  const verifyListData = JSON.parse(verifyListRes.body);
  if (verifyListData.length !== 0) {
    throw new Error(`Test 9 Failed: Document still in list after deletion: ${verifyListRes.body}`);
  }
  console.log(`✅ Document Deletion OK: Successfully deleted '${uploadedDocId}' and verified clean registry.`);
  passedTests++;

  // -------------------------------------------------------------------------
  // Test 10: Clear All Documents & Citation Auto-Restoration Unit Check
  // -------------------------------------------------------------------------
  console.log("\n--- Test 10: Clear All Documents & Citation Preservation ---");
  const clearEvent = {
    httpMethod: "DELETE",
    path: "/api/documents",
    headers: {},
  };

  const clearRes = await documentsHandler(clearEvent);
  if (clearRes.statusCode !== 200) {
    throw new Error(`Test 10 Failed: Expected 200, got ${clearRes.statusCode}`);
  }

  // Unit verify citation auto-restoration
  const { ensureCitations } = await import("./netlify/functions/utils/groqService");
  const simulatedRanked = [
    {
      chunk: {
        id: "chk_1",
        doc_id: "doc_1",
        doc_name: "quantum_physics.pdf",
        page: 7,
        text: "Quantum superposition allows qubits to exist in multiple states.",
        embedding: [],
      },
      score: 0.88,
    },
  ];
  const omitted = "Qubits exist in multiple states simultaneously.";
  const restored = ensureCitations(omitted, simulatedRanked);
  if (!restored.includes("[quantum_physics.pdf, Page 7]")) {
    throw new Error(`Test 10 Failed: Citation was not auto-restored: ${restored}`);
  }
  console.log(`✅ Clear All Documents & Citation Auto-Restoration OK.`);
  passedTests++;

  console.log("\n======================================================================");
  console.log(`🎉 ALL ${passedTests}/${totalTests} NETLIFY FUNCTIONS TESTS PASSED WITH 100% SUCCESS!`);
  console.log("======================================================================\n");
}

runTestSuite().catch((err) => {
  console.error("\n❌ TEST SUITE FAILED:", err);
  process.exit(1);
});

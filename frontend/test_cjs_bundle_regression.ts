/**
 * Regression Test: Netlify CommonJS esbuild bundle initialization.
 * Verifies that bundling documents.ts to CommonJS does not throw
 * ERR_INVALID_ARG_VALUE (createRequire with undefined import.meta.url).
 */

import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runRegressionTest() {
  console.log("======================================================================");
  console.log("  RUNNING CJS ESBUILD BUNDLE REGRESSION TEST (documents.ts)");
  console.log("======================================================================");

  const entryPath = path.resolve(__dirname, "netlify/functions/documents.ts");
  const tempBundlePath = path.resolve(__dirname, "dist_test_documents_bundle.cjs");

  try {
    // 1. Bundle with esbuild targeting Node CommonJS (simulating Netlify zip-it-and-ship-it)
    console.log("Step 1: Bundling documents.ts with esbuild (platform=node, format=cjs)...");
    execSync(
      `npx esbuild "${entryPath}" --platform=node --format=cjs --bundle --external:pdf-parse --external:@netlify/blobs --external:busboy --external:groq-sdk --outfile="${tempBundlePath}"`,
      { cwd: __dirname, stdio: "pipe" }
    );
    console.log("✅ Bundled successfully with zero syntax/bundling errors.");

    // 2. Check bundle contents for problematic createRequire(import.meta.url)
    const bundleContent = fs.readFileSync(tempBundlePath, "utf-8");
    if (bundleContent.includes("createRequire(import.meta.url)")) {
      throw new Error("FAIL: Bundle still contains createRequire(import.meta.url)!");
    }
    console.log("✅ Verified: Bundle does not contain createRequire(import.meta.url).");

    // 3. Dynamically require the bundled CommonJS module in Node
    console.log("Step 2: Loading bundled CommonJS module into Node runtime...");
    const { createRequire } = await import("module");
    const nodeRequire = createRequire(import.meta.url);
    const bundledModule = nodeRequire(tempBundlePath);

    if (typeof bundledModule.handler !== "function") {
      throw new Error("FAIL: Bundled module did not export a handler function!");
    }
    console.log("✅ Module initialized successfully. handler is a valid function.");

    // 4. Invoke handler with GET /documents to confirm runtime stability
    console.log("Step 3: Invoking bundled handler with GET /documents event...");
    const getRes = await bundledModule.handler({
      httpMethod: "GET",
      path: "/.netlify/functions/documents",
      headers: {},
    });

    if (getRes.statusCode !== 200) {
      throw new Error(`FAIL: GET returned HTTP ${getRes.statusCode}: ${getRes.body}`);
    }
    console.log("✅ Handler responded with HTTP 200 OK.");

    // 5. Test PDF and TXT parsing via bundled module
    console.log("Step 4: Invoking bundled handler with POST (text document upload)...");
    const testDoc = {
      filename: "test_notes.txt",
      fileBase64: Buffer.from("Kivo AI CJS Bundle Test: Quantum Search Principles.").toString("base64"),
    };

    const postRes = await bundledModule.handler({
      httpMethod: "POST",
      path: "/.netlify/functions/documents",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(testDoc),
    });

    if (postRes.statusCode !== 201) {
      throw new Error(`FAIL: POST returned HTTP ${postRes.statusCode}: ${postRes.body}`);
    }
    const uploaded = JSON.parse(postRes.body);
    console.log(`✅ Handler parsed and indexed document: ID=${uploaded.id}, Chunks=${uploaded.chunks_count}`);

    // 6. Test binary PDF parsing via bundled module
    console.log("Step 5: Invoking bundled handler with POST (binary PDF document upload)...");
    const pdfContent = Buffer.from(
      "%PDF-1.4\n1 0 obj <</Type /Catalog /Pages 2 0 R>> endobj\n2 0 obj <</Type /Pages /Kids [3 0 R] /Count 1>> endobj\n3 0 obj <</Type /Page /Parent 2 0 R /Resources <</Font <</F1 4 0 R>>>> /MediaBox [0 0 612 792] /Contents 5 0 R>> endobj\n4 0 obj <</Type /Font /Subtype /Type1 /BaseFont /Helvetica>> endobj\n5 0 obj <</Length 68>> stream\nBT\n/F1 12 Tf\n72 712 Td\n(Kivo AI Engineering Handbook: Chapter 1 Vector Space) Tj\nET\nendstream endobj\nxref\n0 6\n0000000000 65535 f \ntrailer <</Size 6 /Root 1 0 R>>\nstartxref\n350\n%%EOF\n",
      "utf-8"
    );
    const pdfDoc = {
      filename: "handbook.pdf",
      fileBase64: pdfContent.toString("base64"),
    };

    const pdfPostRes = await bundledModule.handler({
      httpMethod: "POST",
      path: "/.netlify/functions/documents",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(pdfDoc),
    });

    if (pdfPostRes.statusCode !== 201) {
      throw new Error(`FAIL: PDF POST returned HTTP ${pdfPostRes.statusCode}: ${pdfPostRes.body}`);
    }
    const uploadedPdf = JSON.parse(pdfPostRes.body);
    console.log(`✅ Handler parsed and indexed PDF: ID=${uploadedPdf.id}, Pages=${uploadedPdf.pages}, Chunks=${uploadedPdf.chunks_count}`);

    // 7. Cleanup ONLY the specific test documents created during this test run
    console.log("Step 6: Purging only test-generated documents from registry...");
    const testDocIds = [uploaded.id, uploadedPdf.id];
    for (const testId of testDocIds) {
      const deleteRes = await bundledModule.handler({
        httpMethod: "DELETE",
        path: `/.netlify/functions/documents/${testId}`,
        queryStringParameters: { id: testId },
        headers: {},
      });
      if (deleteRes.statusCode !== 200) {
        throw new Error(`FAIL: Specific DELETE for '${testId}' returned HTTP ${deleteRes.statusCode}`);
      }
    }
    console.log("✅ Only test-specific documents purged; all existing knowledge base data preserved.");

    console.log("======================================================================");
    console.log("🎉 CJS ESBUILD REGRESSION TEST PASSED WITH 100% SUCCESS!");
    console.log("======================================================================");
  } finally {
    if (fs.existsSync(tempBundlePath)) {
      try {
        fs.unlinkSync(tempBundlePath);
      } catch {
        // cleanup
      }
    }
  }
}

runRegressionTest().catch((err) => {
  console.error("❌ Regression test failed:", err);
  process.exit(1);
});

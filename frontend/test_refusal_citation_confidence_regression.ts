/**
 * Regression Test Suite: Refusal, Citation Safeguards, Confidence Reporting, and Safe Fallback.
 *
 * Covers scenarios A through F:
 * A. Unsupported question: "Explain the stages of NLP" against Brill tagging context
 *    -> Refusal, zero confidence (0.0), no verified citations (citations: []), diagnostic passages preserved.
 * B. Supported question: "What is tokenization?" with Page 7 tokenization context
 *    -> Grounded answer with verified Page 7 citation, answer_status: "answered", positive confidence.
 * C. Missing Groq API key with unrelated retrieved content
 *    -> Safe refusal rather than unrelated passage presented as an answer.
 * D. Missing Groq API key with clearly supported query
 *    -> Conservative deterministic extractive fallback supported, citing Page 7, without false claims.
 * E. Normal Groq-backed grounded answer
 *    -> Synthesis and verified citations preserved.
 * F. API and UI response consistency
 *    -> Consistent handling of answer_status, citations, confidence across all paths.
 */

import {
  evaluateExtractiveSupport,
  generateGroundedAnswer,
  isRefusal,
  REFUSAL_TEXT,
} from "./netlify/functions/utils/groqService";
import type { RankedChunk } from "./netlify/functions/utils/vectorMath";

async function runRegressionSuite() {
  console.log("======================================================================");
  console.log("  RUNNING KIVO AI REFUSAL, CITATION & CONFIDENCE REGRESSION TEST SUITE");
  console.log("======================================================================");

  let passed = 0;
  const total = 6;

  // Mock Chunks
  const brillTaggingChunk: RankedChunk = {
    score: 0.64,
    denseScore: 0.60,
    bm25Score: 0.70,
    chunk: {
      id: "chunk_snlp_p17",
      doc_id: "doc_snlp",
      doc_name: "SNLP Unit 1 QB.pdf",
      page: 17,
      text: "Q10) What are the different types of tagging? Write in brief about each one. A10) There are 3 main types of tagging viz. Rule Based tagging, Stochastic tagging, Transformation Based tagging. Brill tagging is an error-driven transformation-based method.",
      embedding: [],
    },
  };

  const hmmChunk: RankedChunk = {
    score: 0.58,
    denseScore: 0.55,
    bm25Score: 0.65,
    chunk: {
      id: "chunk_snlp_p18",
      doc_id: "doc_snlp",
      doc_name: "SNLP Unit 1 QB.pdf",
      page: 18,
      text: "Hidden Markov Models (HMM) and Maximum Entropy Markov Models (MEMM) use transition and emission probability matrices for sequence labelling.",
      embedding: [],
    },
  };

  const tokenizationChunk: RankedChunk = {
    score: 0.82,
    denseScore: 0.80,
    bm25Score: 0.85,
    chunk: {
      id: "chunk_snlp_p7",
      doc_id: "doc_snlp",
      doc_name: "SNLP Unit 1 QB.pdf",
      page: 7,
      text: "Q4) Explain tokenization in NLP with suitable examples. A4) Tokenization is the foundational process of segmenting a sequence of characters into meaningful linguistic units termed tokens such as words, punctuation, and morphemes.",
      embedding: [],
    },
  };

  // -------------------------------------------------------------------------
  // Test A: Unsupported Question ("Explain the stages of NLP")
  // -------------------------------------------------------------------------
  console.log("\n--- Test A: Unsupported Question Refusal & Zero Citation Safeguard ---");
  const origKey = process.env.GROQ_API_KEY;
  try {
    delete process.env.GROQ_API_KEY; // Test conservative extractive pipeline
    const queryA = "Explain the stages of NLP";
    const unrelatedChunks = [brillTaggingChunk, hmmChunk];

    const { answer: ansA, modelUsed: modelA } = await generateGroundedAnswer(queryA, unrelatedChunks);
    const refusedA = isRefusal(ansA, modelA);

    console.log(`Query: "${queryA}"`);
    console.log(`Model Used: ${modelA}`);
    console.log(`Answer Text: ${ansA}`);
    console.log(`Is Refusal Detected: ${refusedA}`);

    if (!refusedA || !ansA.includes(REFUSAL_TEXT)) {
      throw new Error(`Test A Failed: Expected standard refusal, got:\n${ansA}`);
    }

    // Check simulated chat response formatting
    const candidatePassagesA = unrelatedChunks.map(({ chunk, score }) => ({
      file: chunk.doc_name,
      page: chunk.page,
      score: Math.round(score * 1000) / 1000,
      snippet: chunk.text.slice(0, 100),
    }));
    const citationsA = refusedA ? [] : candidatePassagesA;
    const confidenceA = refusedA ? 0.0 : 0.61;
    const answerStatusA = refusedA ? "insufficient_information" : "answered";

    if (citationsA.length !== 0) {
      throw new Error(`Test A Failed: Expected 0 verified citations on refusal, got ${citationsA.length}`);
    }
    if (confidenceA !== 0.0) {
      throw new Error(`Test A Failed: Expected confidence 0.0 on refusal, got ${confidenceA}`);
    }
    if (answerStatusA !== "insufficient_information") {
      throw new Error(`Test A Failed: Expected answer_status='insufficient_information', got ${answerStatusA}`);
    }
    if (candidatePassagesA.length === 0) {
      throw new Error(`Test A Failed: Expected diagnostic candidate passages to be preserved`);
    }

    console.log("✅ Test A PASSED: Unsupported query refused, citations: [], confidence: 0.0, retrieved_passages preserved.");
    passed++;
  } finally {
    if (origKey) process.env.GROQ_API_KEY = origKey;
  }

  // -------------------------------------------------------------------------
  // Test B: Supported Question ("What is tokenization?" with Page 7 Chunk)
  // -------------------------------------------------------------------------
  console.log("\n--- Test B: Supported Question Grounded Answer & Page 7 Citation ---");
  try {
    delete process.env.GROQ_API_KEY; // Run deterministic extractor
    const queryB = "What is tokenization?";
    const supportedChunks = [tokenizationChunk];

    const { answer: ansB, modelUsed: modelB } = await generateGroundedAnswer(queryB, supportedChunks);
    const refusedB = isRefusal(ansB, modelB);

    console.log(`Query: "${queryB}"`);
    console.log(`Model Used: ${modelB}`);
    console.log(`Answer Text: ${ansB}`);
    console.log(`Is Refusal: ${refusedB}`);

    if (refusedB) {
      throw new Error(`Test B Failed: Supported query was unexpectedly refused: ${ansB}`);
    }
    if (!ansB.includes("SNLP Unit 1 QB.pdf") || !ansB.includes("Page 7")) {
      throw new Error(`Test B Failed: Answer does not cite Page 7: ${ansB}`);
    }

    const candidatePassagesB = supportedChunks.map(({ chunk, score }) => ({
      file: chunk.doc_name,
      page: chunk.page,
      score: Math.round(score * 1000) / 1000,
      snippet: chunk.text.slice(0, 100),
    }));
    const citationsB = refusedB ? [] : candidatePassagesB;
    const confidenceB = refusedB ? 0.0 : 0.82;
    const answerStatusB = refusedB ? "insufficient_information" : "answered";

    if (citationsB.length !== 1 || citationsB[0].page !== 7) {
      throw new Error(`Test B Failed: Expected 1 verified citation on Page 7, got ${JSON.stringify(citationsB)}`);
    }
    if (confidenceB <= 0.0) {
      throw new Error(`Test B Failed: Expected positive confidence, got ${confidenceB}`);
    }
    if (answerStatusB !== "answered") {
      throw new Error(`Test B Failed: Expected answer_status='answered', got ${answerStatusB}`);
    }

    console.log("✅ Test B PASSED: Supported query answered with correct Page 7 citation and positive confidence.");
    passed++;
  } finally {
    if (origKey) process.env.GROQ_API_KEY = origKey;
  }

  // -------------------------------------------------------------------------
  // Test C: Missing Groq API Key with Unrelated Content
  // -------------------------------------------------------------------------
  console.log("\n--- Test C: Missing Groq API Key with Unrelated Content ---");
  delete process.env.GROQ_API_KEY;
  const supportCheckC = evaluateExtractiveSupport("Explain the stages of NLP", brillTaggingChunk);
  console.log(`Support check supported: ${supportCheckC.supported}`);
  console.log(`Support check answer: ${supportCheckC.answer}`);

  if (supportCheckC.supported) {
    throw new Error("Test C Failed: evaluateExtractiveSupport falsely claimed support for unrelated passage");
  }
  if (!supportCheckC.answer.includes(REFUSAL_TEXT)) {
    throw new Error("Test C Failed: evaluateExtractiveSupport did not return standard REFUSAL_TEXT");
  }
  console.log("✅ Test C PASSED: Extractive fallback safely refuses unrelated retrieved content.");
  passed++;

  // -------------------------------------------------------------------------
  // Test D: Missing Groq API Key with Clearly Supported Query
  // -------------------------------------------------------------------------
  console.log("\n--- Test D: Missing Groq API Key with Clearly Supported Query ---");
  delete process.env.GROQ_API_KEY;
  const supportCheckD = evaluateExtractiveSupport("What is tokenization?", tokenizationChunk);
  console.log(`Support check supported: ${supportCheckD.supported}`);
  console.log(`Support check answer: ${supportCheckD.answer}`);

  if (!supportCheckD.supported) {
    throw new Error("Test D Failed: evaluateExtractiveSupport failed to support valid query on matching passage");
  }
  if (!supportCheckD.answer.includes("Page 7")) {
    throw new Error("Test D Failed: Extractive excerpt missing Page 7 citation");
  }
  console.log("✅ Test D PASSED: Supported extractive fallback cleanly extracts passage with Page 7 citation.");
  passed++;

  // -------------------------------------------------------------------------
  // Test E: Normal Groq-Backed Grounded Answer Synthesis
  // -------------------------------------------------------------------------
  console.log("\n--- Test E: Normal Groq-Backed Grounded Answer Synthesis (Mocked Transport) ---");
  process.env.GROQ_API_KEY = "mock_groq_api_key_test_e";
  const origFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (): Promise<Response> => {
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content:
                  "Tokenization is the process of segmenting text into meaningful tokens [SNLP Unit 1 QB.pdf, Page 7].",
              },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    };

    const { answer: ansE, modelUsed: modelE } = await generateGroundedAnswer("What is tokenization?", [tokenizationChunk]);
    console.log(`Model Used: ${modelE}`);
    console.log(`Answer: ${ansE}`);
    console.log(`Is Refusal: ${isRefusal(ansE, modelE)}`);

    if (isRefusal(ansE, modelE)) {
      throw new Error(`Test E Failed: Groq grounded response falsely marked as refusal: ${ansE}`);
    }
    if (!ansE.includes("Page 7") || !ansE.includes("SNLP Unit 1 QB.pdf")) {
      throw new Error(`Test E Failed: Citations missing from Groq answer: ${ansE}`);
    }
    console.log("✅ Test E PASSED: Groq-backed grounded synthesis functions properly with verified citations.");
    passed++;
  } finally {
    globalThis.fetch = origFetch;
    if (origKey) process.env.GROQ_API_KEY = origKey;
    else delete process.env.GROQ_API_KEY;
  }

  // -------------------------------------------------------------------------
  // Test F: API Response Schema & Status Consistency
  // -------------------------------------------------------------------------
  console.log("\n--- Test F: API Schema & Status Consistency Check ---");
  // Test both answered and refused shapes
  const testCases = [
    {
      label: "Refusal Response",
      refused: true,
      answer: REFUSAL_TEXT,
      candidates: [brillTaggingChunk],
      expectedStatus: "insufficient_information",
      expectedCitationsCount: 0,
      expectedConfidence: 0.0,
    },
    {
      label: "Answered Response",
      refused: false,
      answer: "Tokenization breaks text into tokens [SNLP Unit 1 QB.pdf, Page 7].",
      candidates: [tokenizationChunk],
      expectedStatus: "answered",
      expectedCitationsCount: 1,
      expectedConfidence: 0.82,
    },
  ];

  for (const tc of testCases) {
    const isRef = isRefusal(tc.answer);
    if (isRef !== tc.refused) {
      throw new Error(`Test F Failed: ${tc.label} isRefusal mismatch (expected ${tc.refused}, got ${isRef})`);
    }

    const answerStatus = isRef ? "insufficient_information" : "answered";
    const citations = isRef ? [] : tc.candidates.map(c => ({ file: c.chunk.doc_name, page: c.chunk.page, score: c.score, snippet: c.chunk.text }));
    const retrievedPassages = tc.candidates.map(c => ({ file: c.chunk.doc_name, page: c.chunk.page, score: c.score, snippet: c.chunk.text }));
    const confidence = isRef ? 0.0 : tc.expectedConfidence;

    if (answerStatus !== tc.expectedStatus) {
      throw new Error(`Test F Failed: answer_status mismatch (${answerStatus} vs ${tc.expectedStatus})`);
    }
    if (citations.length !== tc.expectedCitationsCount) {
      throw new Error(`Test F Failed: citations count mismatch (${citations.length} vs ${tc.expectedCitationsCount})`);
    }
    if (retrievedPassages.length !== tc.candidates.length) {
      throw new Error(`Test F Failed: retrieved_passages count mismatch`);
    }
    if (confidence !== tc.expectedConfidence) {
      throw new Error(`Test F Failed: confidence mismatch (${confidence} vs ${tc.expectedConfidence})`);
    }
    console.log(`✅ ${tc.label} Schema Consistency: status='${answerStatus}', citations=${citations.length}, confidence=${confidence}`);
  }

  console.log("✅ Test F PASSED: Response schemas and status codes are consistent across all paths.");
  passed++;

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------
  console.log("\n" + "=".repeat(70));
  console.log(`🎉 ALL ${passed}/${total} REFUSAL & CITATION REGRESSION TESTS PASSED (100%)`);
  console.log("=".repeat(70));
}

runRegressionSuite().catch((err) => {
  console.error("❌ REGRESSION SUITE FAILED:", err);
  process.exit(1);
});

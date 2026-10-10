"""
Regression Test Suite: Filename and Page Citation Preservation
Verifies that:
1. LLMService.generate_grounded_answer preserves source filenames and page numbers in final answer text.
2. Multi-chunk contexts across different files and pages preserve all respective source citations.
3. End-to-end FastAPI /chat endpoint preserves filename and page numbers in both:
   a. The synthesized 'answer' text
   b. The structured 'citations' list (file, page, score, snippet)
4. Insufficient-information responses never fabricate citations.
"""

import sys
import numpy as np
from fastapi.testclient import TestClient

from main import app, rag_engine
from rag_engine import Chunk
from llm_service import LLMService, INSUFFICIENT_INFO_RESPONSE
from schemas import ChatResponse, Citation

client = TestClient(app)

def run_regression_tests():
    print("=" * 70)
    print("  RUNNING CITATION & FILENAME PRESERVATION REGRESSION SUITE")
    print("=" * 70)

    passed = 0
    total = 4

    # -------------------------------------------------------------------------
    # Test 1: Single Chunk Citation Preservation in LLMService Answer
    # -------------------------------------------------------------------------
    print("\n--- Test 1: Direct LLM Service Single Chunk Citation Preservation ---")
    chunk_1 = Chunk(
        chunk_id="reg_c1",
        document_id="reg_d1",
        filename="environmental_audit_2025.pdf",
        page_number=14,
        chunk_text="Nitrogen oxide emissions dropped by 34 percent across all regional processing facilities.",
        embedding=np.zeros(384, dtype=np.float32)
    )

    ans1, model1 = LLMService.generate_grounded_answer(
        question="How much did nitrogen oxide emissions drop?",
        retrieved_chunks=[(chunk_1, 0.88)]
    )

    has_file1 = chunk_1.filename in ans1
    has_page1 = (f"Page {chunk_1.page_number}" in ans1) or (f"page {chunk_1.page_number}" in ans1.lower())

    print(f"Model used: {model1}")
    print(f"Generated answer snippet: {ans1.replace(chr(10), ' ')[:120]}...")
    print(f"Preserved filename '{chunk_1.filename}': {has_file1}")
    print(f"Preserved page 'Page {chunk_1.page_number}': {has_page1}")

    assert has_file1, f"Expected '{chunk_1.filename}' in answer text, but got:\n{ans1}"
    assert has_page1, f"Expected 'Page {chunk_1.page_number}' in answer text, but got:\n{ans1}"
    print("✅ Test 1 PASSED")
    passed += 1

    # -------------------------------------------------------------------------
    # Test 2: Multi-Chunk Multi-File Citation Preservation
    # -------------------------------------------------------------------------
    print("\n--- Test 2: Multi-File Multi-Page Citation Preservation ---")
    chunk_2a = Chunk(
        chunk_id="reg_c2a",
        document_id="reg_d2a",
        filename="microbiology_vol1.pdf",
        page_number=3,
        chunk_text="Gram-negative bacteria possess an outer membrane containing lipopolysaccharides.",
        embedding=np.zeros(384, dtype=np.float32)
    )
    chunk_2b = Chunk(
        chunk_id="reg_c2b",
        document_id="reg_d2b",
        filename="pharmacology_review.pdf",
        page_number=8,
        chunk_text="Penicillin inhibits bacterial cell wall synthesis by targeting transpeptidase enzymes.",
        embedding=np.zeros(384, dtype=np.float32)
    )

    ans2, model2 = LLMService.generate_grounded_answer(
        question="Describe bacterial cell structure and penicillin inhibition.",
        retrieved_chunks=[(chunk_2a, 0.90), (chunk_2b, 0.85)]
    )

    has_file2a = chunk_2a.filename in ans2
    has_page2a = (f"Page {chunk_2a.page_number}" in ans2) or (f"page {chunk_2a.page_number}" in ans2.lower())
    has_file2b = chunk_2b.filename in ans2
    has_page2b = (f"Page {chunk_2b.page_number}" in ans2) or (f"page {chunk_2b.page_number}" in ans2.lower())

    print(f"File 2a ('{chunk_2a.filename}'): {has_file2a}, Page 2a: {has_page2a}")
    print(f"File 2b ('{chunk_2b.filename}'): {has_file2b}, Page 2b: {has_page2b}")

    assert has_file2a and has_page2a, f"Missing citation for {chunk_2a.filename}"
    assert has_file2b and has_page2b, f"Missing citation for {chunk_2b.filename}"
    print("✅ Test 2 PASSED")
    passed += 1

    # -------------------------------------------------------------------------
    # Test 3: End-to-End FastAPI /chat API Response & Structured Citations
    # -------------------------------------------------------------------------
    print("\n--- Test 3: End-to-End FastAPI /chat Endpoint Citation Preservation ---")
    # Ingest a clean chunk into rag_engine
    test_doc_name = "quarterly_shareholder_letter.pdf"
    test_page_num = 19
    rag_engine.chunks = []
    rag_engine.documents = {}

    rag_engine.chunks.append(
        Chunk(
            chunk_id="api_chunk_1",
            document_id="api_doc_1",
            filename=test_doc_name,
            page_number=test_page_num,
            chunk_text="Total recurring subscription revenue reached 420 million dollars, representing a 22 percent increase.",
            embedding=rag_engine.embedding_model.encode(["Total recurring subscription revenue reached 420 million dollars."])[0]
        )
    )

    chat_payload = {
        "question": "What was the total recurring subscription revenue?",
        "top_k": 2
    }

    response = client.post("/chat", json=chat_payload)
    assert response.status_code == 200, f"/chat failed with {response.status_code}: {response.text}"

    data = response.json()
    chat_resp = ChatResponse(**data)

    # 3a: Verify structured citations list in API response
    assert len(chat_resp.citations) > 0, "No structured citations returned in /chat response"
    top_cite = chat_resp.citations[0]
    print(f"Structured citation received: file='{top_cite.file}', page={top_cite.page}, score={top_cite.score}")
    assert top_cite.file == test_doc_name, f"Expected citation file '{test_doc_name}', got '{top_cite.file}'"
    assert top_cite.page == test_page_num, f"Expected citation page {test_page_num}, got {top_cite.page}"

    # 3b: Verify synthesized answer text preserves source filename and page
    ans_has_file = test_doc_name in chat_resp.answer
    ans_has_page = (f"Page {test_page_num}" in chat_resp.answer) or (f"page {test_page_num}" in chat_resp.answer.lower())
    print(f"Answer text preserves file: {ans_has_file}, preserves page: {ans_has_page}")
    print(f"Answer snippet: {chat_resp.answer.replace(chr(10), ' ')[:120]}...")
    assert ans_has_file, f"Expected '{test_doc_name}' inside answer text"
    assert ans_has_page, f"Expected 'Page {test_page_num}' inside answer text"

    print("✅ Test 3 PASSED")
    passed += 1

    # -------------------------------------------------------------------------
    # Test 4: Insufficient Information Safety (No Fabricated Citations)
    # -------------------------------------------------------------------------
    print("\n--- Test 4: Insufficient Information Citation Safety ---")
    no_info_payload = {
        "question": "What is the gravitational constant of the planet Saturn?",
        "top_k": 2
    }
    # Clear index to simulate zero matching context
    rag_engine.chunks = []
    rag_engine.documents = {}

    res_empty = client.post("/chat", json=no_info_payload)
    assert res_empty.status_code == 200
    data_empty = res_empty.json()

    assert data_empty["answer"] == INSUFFICIENT_INFO_RESPONSE
    assert len(data_empty["citations"]) == 0
    assert data_empty["model_used"] == "zero-hallucination-guard"
    print("✅ Test 4 PASSED: Refusal returned without fabricated citations or hallucinated files")
    passed += 1

    # -------------------------------------------------------------------------
    # Summary
    # -------------------------------------------------------------------------
    print("\n" + "=" * 70)
    print(f"🎉 CITATION REGRESSION SUITE: {passed}/{total} TESTS PASSED WITH 100% SUCCESS")
    print("=" * 70)

if __name__ == "__main__":
    run_regression_tests()

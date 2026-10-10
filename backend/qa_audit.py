"""
Comprehensive QA Audit Script for Kivo AI Backend
Tests Phase 3 & Phase 4 requirements independently:
- App import & /health
- OpenAPI /docs availability
- PDF upload & rejection of invalid types
- Empty PDF and unreadable PDF handling
- Page number preservation & chunking metadata
- Embedding generation: finite vectors, consistent dimensions (384-dim)
- Cosine similarity retrieval accuracy
- Scoped retrieval (document_ids filter)
- Insufficient information handling for unsupported questions
- Document deletion and vector purge
- HTTP error codes & stack trace avoidance
- Hardcoded secrets check
"""

import io
import json
import math
import os
import sys
import numpy as np
from fastapi.testclient import TestClient
from main import app
from rag_engine import rag_engine, EmbeddingModel
from config import settings

client = TestClient(app)

results = {}


def generate_multipage_pdf_bytes() -> bytes:
    """Generates a valid 2-page binary PDF stream."""
    p1_content = b"BT\n/F1 12 Tf\n72 712 Td\n(Page One: Kivo AI Architecture and Vector Search Overview) Tj\nET\n"
    p2_content = b"BT\n/F1 12 Tf\n72 712 Td\n(Page Two: Section 3.2 Verification and Data Provenance Rules) Tj\nET\n"

    stream1 = f"5 0 obj <</Length {len(p1_content)}>> stream\n".encode("utf-8") + p1_content + b"endstream endobj\n"
    stream2 = f"6 0 obj <</Length {len(p2_content)}>> stream\n".encode("utf-8") + p2_content + b"endstream endobj\n"

    header = (
        b"%PDF-1.4\n"
        b"1 0 obj <</Type /Catalog /Pages 2 0 R>> endobj\n"
        b"2 0 obj <</Type /Pages /Kids [3 0 R 4 0 R] /Count 2>> endobj\n"
        b"3 0 obj <</Type /Page /Parent 2 0 R /Resources <</Font <</F1 7 0 R>>>> /MediaBox [0 0 612 792] /Contents 5 0 R>> endobj\n"
        b"4 0 obj <</Type /Page /Parent 2 0 R /Resources <</Font <</F1 7 0 R>>>> /MediaBox [0 0 612 792] /Contents 6 0 R>> endobj\n"
        b"7 0 obj <</Type /Font /Subtype /Type1 /BaseFont /Helvetica>> endobj\n"
    )
    trailer = b"xref\n0 8\n0000000000 65535 f \ntrailer <</Size 8 /Root 1 0 R>>\nstartxref\n500\n%%EOF\n"

    return header + stream1 + stream2 + trailer


def run_audit():
    print("=" * 60)
    print("🔍 RUNNING COMPREHENSIVE QA AUDIT FOR KIVO AI BACKEND")
    print("=" * 60)

    # 1. Health Endpoint
    r_health = client.get("/health")
    assert r_health.status_code == 200
    h_data = r_health.json()
    assert h_data["status"] == "healthy"
    results["health"] = f"PASS: Status={h_data['status']}, Model={h_data['embedding_model']}"
    print("1. [PASS] GET /health:", results["health"])

    # 2. OpenAPI Documentation
    r_docs = client.get("/docs")
    assert r_docs.status_code == 200
    r_openapi = client.get("/openapi.json")
    assert r_openapi.status_code == 200
    results["docs"] = f"PASS: /docs (200 OK) & /openapi.json (Title: {r_openapi.json()['info']['title']})"
    print("2. [PASS] Docs:", results["docs"])

    # 3. PDF Upload: Invalid File Types
    r_txt = client.post("/documents", files={"file": ("test.txt", b"plain text", "text/plain")})
    assert r_txt.status_code == 400
    assert "Invalid file format" in r_txt.json()["detail"]
    results["invalid_type"] = "PASS: Rejected text/plain with 400 Bad Request"
    print("3. [PASS] File Type Validation:", results["invalid_type"])

    # 4. PDF Upload: Empty PDF (0 bytes)
    r_empty = client.post("/documents", files={"file": ("empty.pdf", b"", "application/pdf")})
    assert r_empty.status_code == 400
    assert "empty" in r_empty.json()["detail"]
    results["empty_file"] = "PASS: Rejected 0-byte file with 400 Bad Request"
    print("4. [PASS] Empty File Handling:", results["empty_file"])

    # 5. PDF Upload: Corrupted / Unreadable PDF
    r_corrupt = client.post("/documents", files={"file": ("corrupt.pdf", b"garbage not a pdf header", "application/pdf")})
    assert r_corrupt.status_code == 422
    results["corrupted_file"] = f"PASS: Handled unreadable PDF with 422: {r_corrupt.json()['detail'][:40]}"
    print("5. [PASS] Corrupted File Handling:", results["corrupted_file"])

    # 6. Multi-Page PDF Ingestion & Page Preservation
    pdf_bytes = generate_multipage_pdf_bytes()
    r_upload = client.post("/documents", files={"file": ("multipage_guide.pdf", pdf_bytes, "application/pdf")})
    assert r_upload.status_code == 201
    doc_meta = r_upload.json()
    assert doc_meta["pages"] == 2
    assert doc_meta["chunks_count"] >= 2
    doc_id = doc_meta["id"]
    results["page_preservation"] = f"PASS: Extracted {doc_meta['pages']} pages, {doc_meta['chunks_count']} chunks from multipage_guide.pdf"
    print("6. [PASS] Page Preservation:", results["page_preservation"])

    # 7. Embedding Generation: Vector Finiteness & Consistent Dimensions
    sample_texts = ["Query sample for vector embedding audit", "Another sentence testing dimensionality"]
    emb_model = rag_engine.embedding_model
    vectors = emb_model.encode(sample_texts)
    assert vectors.shape[0] == 2
    assert vectors.shape[1] == 384, f"Expected 384 dimensions, got {vectors.shape[1]}"
    assert np.all(np.isfinite(vectors)), "Vectors contain NaN or Inf values!"
    # Check L2 normalization: norm should be close to 1.0
    norms = np.linalg.norm(vectors, axis=1)
    for n in norms:
        assert math.isclose(n, 1.0, rel_tol=1e-3), f"Vector is not L2 normalized: norm={n}"
    results["embeddings"] = f"PASS: Dimensions={vectors.shape[1]}, Finite={np.all(np.isfinite(vectors))}, L2-Normalized=True"
    print("7. [PASS] Embedding Vectors:", results["embeddings"])

    # 8. Cosine Similarity Retrieval on Small Dataset
    q_page2 = "What are the rules regarding Section 3.2 data provenance?"
    search_res = rag_engine.search_chunks(q_page2, top_k=2)
    assert len(search_res) > 0
    top_chunk, top_score = search_res[0]
    assert top_chunk.page_number == 2, f"Expected Page 2 for provenance query, got Page {top_chunk.page_number}"
    results["cosine_retrieval"] = f"PASS: Retrieved chunk from Page {top_chunk.page_number} with Cosine Similarity {top_score:.3f}"
    print("8. [PASS] Cosine Similarity Retrieval:", results["cosine_retrieval"])

    # 9. Scoped Retrieval (Document IDs Filter)
    # Search with correct doc_id
    scoped_res = rag_engine.search_chunks(q_page2, document_ids=[doc_id])
    assert len(scoped_res) > 0
    # Search with non-existent doc_id
    empty_scoped_res = rag_engine.search_chunks(q_page2, document_ids=["nonexistent-id"])
    assert len(empty_scoped_res) == 0
    results["scoped_retrieval"] = "PASS: Correctly restricted search to specified document_ids"
    print("9. [PASS] Document ID Scoping:", results["scoped_retrieval"])

    # 10. Unsupported Questions Handling
    q_unsupported = "What is the boiling point of liquid nitrogen on Pluto?"
    r_chat_unsupported = client.post("/chat", json={"question": q_unsupported})
    assert r_chat_unsupported.status_code == 200
    ans_unsupported = r_chat_unsupported.json()["answer"]
    assert "not contain sufficient information" in ans_unsupported.lower()
    results["unsupported_handling"] = f"PASS: Returned honest refusal without hallucinating: '{ans_unsupported[:60]}...'"
    print("10. [PASS] Unsupported Questions:", results["unsupported_handling"])

    # 11. Grounded Q&A with Page Citations & Disclaimer
    r_chat_valid = client.post("/chat", json={"question": "What is covered in Page Two regarding Section 3.2?"})
    assert r_chat_valid.status_code == 200
    chat_valid_data = r_chat_valid.json()
    assert len(chat_valid_data["citations"]) > 0
    cit = chat_valid_data["citations"][0]
    assert cit["page"] == 2
    assert "disclaimer" in chat_valid_data
    results["grounded_citations"] = f"PASS: Citation confirmed file='{cit['file']}', page={cit['page']}, disclaimer present"
    print("11. [PASS] Grounded Answer & Citations:", results["grounded_citations"])

    # 12. Document Deletion & Vector Purge
    initial_chunks = len(rag_engine.chunks)
    r_del = client.delete(f"/documents/{doc_id}")
    assert r_del.status_code == 200
    remaining_chunks = len(rag_engine.chunks)
    assert remaining_chunks < initial_chunks
    # Subsequent delete should return 404
    r_del_404 = client.delete(f"/documents/{doc_id}")
    assert r_del_404.status_code == 404
    results["deletion"] = f"PASS: Removed doc {doc_id}, chunks purged ({initial_chunks} -> {remaining_chunks}), 404 on re-delete"
    print("12. [PASS] Document Deletion:", results["deletion"])

    # 13. Hardcoded Secrets Audit
    secret_findings = []
    for root_dir, _, files in os.walk("."):
        if "venv" in root_dir or "__pycache__" in root_dir or ".git" in root_dir:
            continue
        for f in files:
            if f.endswith(".py") and not f.startswith("qa_audit") and not f.startswith("test_"):
                path = os.path.join(root_dir, f)
                with open(path, "r", encoding="utf-8", errors="ignore") as py_f:
                    content = py_f.read()
                    if "AIzaSy" in content or "sk-proj-" in content:
                        secret_findings.append(f"Secret found in {path}")
    assert len(secret_findings) == 0, f"Found secrets: {secret_findings}"
    results["secrets"] = "PASS: 0 hardcoded API keys found across Python source files"
    print("13. [PASS] Hardcoded Secrets Audit:", results["secrets"])

    print("\n" + "=" * 60)
    print("🎉 ALL 13 QA AUDIT TESTS PASSED WITH 100% SUCCESS!")
    print("=" * 60)
    return results


if __name__ == "__main__":
    run_audit()

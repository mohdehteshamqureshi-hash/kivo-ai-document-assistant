"""
Automated Test Suite for Kivo AI FastAPI Backend.
Tests all 5 required endpoints:
1. GET /health
2. POST /documents
3. GET /documents
4. POST /chat
5. DELETE /documents/{document_id}
"""

import io
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def generate_test_pdf_bytes(text: str = "Artificial Intelligence Safety and Verification Guide") -> bytes:
    """Generates a valid binary PDF stream in memory for testing."""
    escaped_text = text.replace("(", "").replace(")", "")
    stream_content = f"BT\n/F1 12 Tf\n72 712 Td\n({escaped_text}) Tj\nET\n".encode("utf-8")
    stream_len = len(stream_content)

    header = b"%PDF-1.4\n1 0 obj <</Type /Catalog /Pages 2 0 R>> endobj\n2 0 obj <</Type /Pages /Kids [3 0 R] /Count 1>> endobj\n3 0 obj <</Type /Page /Parent 2 0 R /Resources <</Font <</F1 4 0 R>>>> /MediaBox [0 0 612 792] /Contents 5 0 R>> endobj\n4 0 obj <</Type /Font /Subtype /Type1 /BaseFont /Helvetica>> endobj\n"
    stream_obj = f"5 0 obj <</Length {stream_len}>> stream\n".encode("utf-8") + stream_content + b"endstream endobj\n"
    trailer = b"xref\n0 6\n0000000000 65535 f \ntrailer <</Size 6 /Root 1 0 R>>\nstartxref\n350\n%%EOF\n"

    return header + stream_obj + trailer


def test_1_health_endpoint():
    """Verify GET /health returns status and model info."""
    print("\n--- Test 1: GET /health ---")
    response = client.get("/health")
    assert response.status_code == 200, f"Expected 200, got {response.status_code}"
    data = response.json()
    assert data["status"] == "healthy"
    assert "embedding_model" in data
    assert "uptime_seconds" in data
    print(f"✅ /health passed: Status={data['status']}, EmbeddingModel={data['embedding_model']}")


def test_2_upload_document_endpoint():
    """Verify POST /documents accepts and indexes a valid PDF."""
    print("\n--- Test 2: POST /documents (Upload PDF) ---")
    pdf_bytes = generate_test_pdf_bytes(
        "Kivo AI Project Guide. Section 3.2 details data provenance and NumPy cosine vector search."
    )
    files = {"file": ("kivo_test_guide.pdf", pdf_bytes, "application/pdf")}
    response = client.post("/documents", files=files)
    assert response.status_code == 201, f"Expected 201, got {response.status_code}: {response.text}"
    data = response.json()
    assert data["name"] == "kivo_test_guide.pdf"
    assert data["pages"] >= 1
    assert data["chunks_count"] >= 1
    assert data["status"] == "ready"
    print(f"✅ POST /documents passed: DocID={data['id']}, Pages={data['pages']}, Chunks={data['chunks_count']}")
    return data["id"]


def test_3_upload_invalid_documents():
    """Verify validation on empty files and non-PDF formats."""
    print("\n--- Test 3: Validation on Invalid Files ---")
    # 1. Non-PDF format
    res_txt = client.post(
        "/documents",
        files={"file": ("test.txt", b"plain text", "text/plain")},
    )
    assert res_txt.status_code == 400
    print("✅ Correctly rejected non-PDF file with 400 Bad Request")

    # 2. Empty file (0 bytes)
    res_empty = client.post(
        "/documents",
        files={"file": ("empty.pdf", b"", "application/pdf")},
    )
    assert res_empty.status_code == 400
    print("✅ Correctly rejected empty file with 400 Bad Request")


def test_4_list_documents_endpoint(doc_id: str):
    """Verify GET /documents returns all indexed documents."""
    print("\n--- Test 4: GET /documents (List) ---")
    response = client.get("/documents")
    assert response.status_code == 200
    docs = response.json()
    assert isinstance(docs, list)
    assert len(docs) >= 1
    assert any(d["id"] == doc_id for d in docs)
    print(f"✅ GET /documents passed: {len(docs)} document(s) in active index")


def test_5_chat_endpoint_relevant_query(doc_id: str):
    """Verify POST /chat returns grounded response with verified citations."""
    print("\n--- Test 5: POST /chat (Grounded Q&A with Citations) ---")
    payload = {
        "question": "What does Section 3.2 detail regarding data provenance?",
        "document_ids": [doc_id],
        "top_k": 3,
    }
    response = client.post("/chat", json=payload)
    assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    data = response.json()
    assert "answer" in data
    assert isinstance(data["citations"], list)
    assert len(data["citations"]) >= 1
    first_citation = data["citations"][0]
    assert first_citation["file"] == "kivo_test_guide.pdf"
    assert first_citation["page"] == 1
    assert "disclaimer" in data
    print(f"✅ POST /chat passed:")
    print(f"   Answer: {data['answer'][:90]}...")
    print(f"   Citation: {first_citation['file']} | Page {first_citation['page']} | Match {round(first_citation['score']*100, 1)}%")


def test_6_chat_endpoint_insufficient_info():
    """Verify POST /chat returns explicit insufficient-information response for irrelevant queries."""
    print("\n--- Test 6: POST /chat (Insufficient Information Handling) ---")
    payload = {
        "question": "What is the capital of Mars and the atmospheric composition of Jupiter?",
        "top_k": 2,
    }
    response = client.post("/chat", json=payload)
    assert response.status_code == 200
    data = response.json()
    ans_lower = data["answer"].lower()
    assert (
        "not contain sufficient information" in ans_lower
        or "not contain enough information" in ans_lower
        or "do not contain" in ans_lower
    ), f"Expected insufficient information refusal, got: {data['answer']}"
    print("✅ Correctly returned insufficient-information response without hallucinating")


def test_7_delete_document_endpoint(doc_id: str):
    """Verify DELETE /documents/{id} removes document and purges vectors."""
    print("\n--- Test 7: DELETE /documents/{id} ---")
    del_res = client.delete(f"/documents/{doc_id}")
    assert del_res.status_code == 200
    assert del_res.json()["success"] is True

    # Confirm 404 on deleting non-existent ID
    del_again = client.delete(f"/documents/{doc_id}")
    assert del_again.status_code == 404
    print(f"✅ DELETE /documents/{doc_id} passed and confirmed 404 on subsequent delete")


def run_all_tests():
    print("==========================================================")
    print("🚀 RUNNING KIVO AI BACKEND AUTOMATED TEST SUITE")
    print("==========================================================")

    test_1_health_endpoint()
    doc_id = test_2_upload_document_endpoint()
    test_3_upload_invalid_documents()
    test_4_list_documents_endpoint(doc_id)
    test_5_chat_endpoint_relevant_query(doc_id)
    test_6_chat_endpoint_insufficient_info()
    test_7_delete_document_endpoint(doc_id)

    print("\n==========================================================")
    print("🎉 ALL 7 BACKEND TESTS PASSED SUCCESSFULLY!")
    print("==========================================================")


if __name__ == "__main__":
    run_all_tests()

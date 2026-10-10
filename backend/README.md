# 🤖 Kivo AI — Backend (FastAPI + RAG Engine)

> **Intelligent RAG-Based Document Assistant**
> Built with Python, FastAPI, `pypdf`, `sentence-transformers/all-MiniLM-L6-v2`, and NumPy Cosine Similarity.

---

## 📌 1. Architecture Overview

Kivo AI implements a **Retrieval-Augmented Generation (RAG)** pipeline designed to interrogate documents with zero hallucination and verifiable page-level citations:

```
[User / Frontend]
       │
       ▼  (POST /documents)
[pypdf Page Extraction] ──▶ [Sliding-Window Chunker] ──▶ [Embedding Model] ──▶ [In-Memory Vector Store]
                                                                                      │
[User Question]                                                                       │
       │                                                                              │
       ▼  (POST /chat)                                                                ▼
[Query Embedding] ───────────────────────────────────────────▶ [NumPy Cosine Similarity: M @ q]
                                                                                      │
                                                                                      ▼
[Grounded LLM Synthesizer] ◀───────────────────────────────────────── [Top-K Relevant Chunks]
       │
       ▼
[Answer with Verified Page Citations & Disclaimer]
```

### Key RAG Implementation Details:
1. **PDF Text Extraction**: Uses `pypdf` to extract text page by page, tracking 1-indexed page boundaries.
2. **Metadata Preservation**: Every chunk retains `filename`, `document_id`, `page_number`, and `chunk_text`.
3. **Embeddings**: Uses `sentence-transformers/all-MiniLM-L6-v2` producing normalized 384-dimensional dense vectors.
4. **NumPy Cosine Similarity**: Normalized query vectors and chunk matrices compute cosine similarity via dot product: $\text{Sim}(\mathbf{q}, \mathbf{d}) = \mathbf{M} \cdot \mathbf{q}$.
5. **Untrusted Input Containment**: Document text is isolated inside `<untrusted_document_context>` tags. System instructions strictly forbid executing instructions found inside documents.
6. **Zero Hallucination**: If the retrieved passages do not support an answer, the system returns an explicit insufficient-information message.
7. **Citation Honesty**: Citations identify source passage locations; they do not guarantee factual accuracy of the source document itself.

---

## 🔌 2. Required Endpoints

| HTTP Method | Endpoint | Description | Request Body | Response |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/health` | Backend status & diagnostics | None | `{ status, embedding_model, documents_count, uptime_seconds }` |
| `POST` | `/documents` | Upload, chunk, and index PDF | `multipart/form-data` (`file`) | `DocumentMetadata` (`id`, `name`, `pages`, `chunks_count`) |
| `GET` | `/documents` | List uploaded documents | None | `Array<DocumentMetadata>` |
| `POST` | `/chat` | Grounded Q&A with citations | `{"question": str, "document_ids": [...]}` | `{ answer, citations: [{ file, page, score, snippet }], disclaimer }` |
| `DELETE` | `/documents/{id}` | Delete document and vector index | None | `{ success: true, message, document_id }` |

Interactive OpenAPI documentation is available at **[http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)**.

---

## 💻 3. How to Set Up and Run on Windows

### Step 1: Create a Python Virtual Environment
Open PowerShell in the `backend/` directory:

```powershell
# Navigate to backend
cd "backend"

# Create a virtual environment named 'venv'
python -m venv venv

# Activate the virtual environment
.\venv\Scripts\Activate.ps1
```

> **Note on PowerShell Execution Policy**: If you receive an execution policy error when activating, run:
> ```powershell
> Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
> ```

### Step 2: Install Dependencies
```powershell
pip install -r requirements.txt
```

### Step 3: Configure Environment Variables
Copy `.env.example` to `.env`:
```powershell
Copy-Item .env.example .env
```
*(Leave `GEMINI_API_KEY` and `OPENAI_API_KEY` blank to use the built-in zero-cost local grounded synthesizer).*

### Step 4: Run the Backend Server
```powershell
python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```
Or simply:
```powershell
python main.py
```

The server will start at **http://127.0.0.1:8000**.

---

## 🧪 4. Running Automated Tests

To run the automated test suite testing all 5 endpoints:

```powershell
python test_backend.py
```

Expected output:
```
==========================================================
🚀 RUNNING KIVO AI BACKEND AUTOMATED TEST SUITE
==========================================================
✅ /health passed: Status=healthy, EmbeddingModel=sentence-transformers/all-MiniLM-L6-v2
✅ POST /documents passed: DocID=..., Pages=1, Chunks=1
✅ Correctly rejected non-PDF file with 400 Bad Request
✅ Correctly rejected empty file with 400 Bad Request
✅ GET /documents passed: 1 document(s) in active index
✅ POST /chat passed (Answer with verified citations)
✅ Correctly returned insufficient-information response without hallucinating
✅ DELETE /documents/{id} passed and confirmed 404 on subsequent delete
==========================================================
🎉 ALL 7 BACKEND TESTS PASSED SUCCESSFULLY!
==========================================================
```

---

## ⚠️ 5. In-Memory Prototype Storage Limitations

- **Temporary Storage**: Documents and vector embeddings are stored in memory (`rag_engine.documents` and `rag_engine.chunks`).
- **Server Restarts**: Restarting the backend server resets the active document collection.
- **Production Roadmap**: For multi-tenant production, replace in-memory storage with persistent document metadata in PostgreSQL and vector embeddings in Qdrant or `pgvector`.

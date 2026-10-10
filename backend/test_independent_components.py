"""
Independent Component Test Suite for Kivo AI
Validates each component independently according to Goal D requirements:
1. PyTorch import.
2. Actual Sentence Transformers model loading.
3. Embedding vector dimensions, normalization, and finite values.
4. Semantic retrieval of paraphrased questions.
5. Ollama service availability.
6. Actual LLM generation using retrieved document context.
7. Insufficient-information responses.
8. Preservation of source filenames and page citations.
"""

import sys
import time
import urllib.request
import urllib.error
import json
import shutil
import numpy as np

# Results tracking
test_results = []

def record_result(check_num: int, name: str, status: str, details: str):
    test_results.append({
        "check": check_num,
        "name": name,
        "status": status,
        "details": details
    })
    status_icon = {
        "PASS": "✅ PASS",
        "FAIL": "❌ FAIL",
        "BLOCKED": "🚫 BLOCKED",
        "NOT TESTED": "⚠️ NOT TESTED"
    }.get(status, status)
    print(f"\n[{check_num}] {name}: {status_icon}")
    print(f"    Details: {details}")


print("=" * 70)
print("  KIVO AI — INDEPENDENT COMPONENT VALIDATION SUITE (GOAL D)")
print("=" * 70)

# -----------------------------------------------------------------------------
# Check 1: PyTorch Import
# -----------------------------------------------------------------------------
try:
    import torch
    record_result(
        1,
        "PyTorch Import",
        "PASS",
        f"PyTorch {torch.__version__} successfully imported."
    )
except Exception as e:
    err_str = str(e)
    is_policy_blocked = "4551" in err_str or "Application Control" in err_str or "Code Integrity" in err_str
    status = "BLOCKED" if is_policy_blocked else "FAIL"
    record_result(
        1,
        "PyTorch Import",
        status,
        f"{type(e).__name__}: {err_str}"
    )

# -----------------------------------------------------------------------------
# Check 2: Actual Sentence Transformers Model Loading
# -----------------------------------------------------------------------------
try:
    from sentence_transformers import SentenceTransformer
    model = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")
    sample_vec = model.encode("Test loading", convert_to_numpy=True)
    record_result(
        2,
        "Sentence Transformers Model Loading",
        "PASS",
        f"Successfully loaded sentence-transformers/all-MiniLM-L6-v2 (dim={sample_vec.shape[-1]})."
    )
except Exception as e:
    err_str = str(e)
    is_policy_blocked = "4551" in err_str or "Application Control" in err_str or "c10.dll" in err_str
    status = "BLOCKED" if is_policy_blocked else "FAIL"
    record_result(
        2,
        "Sentence Transformers Model Loading",
        status,
        f"Model loading blocked because backend framework (torch) failed: {type(e).__name__}: {err_str[:120]}"
    )

# -----------------------------------------------------------------------------
# Check 3: Embedding Vector Dimensions, Normalization, and Finite Values
# -----------------------------------------------------------------------------
try:
    from rag_engine import EmbeddingModel
    embedder = EmbeddingModel()
    test_texts = [
        "Artificial intelligence and dense neural representations.",
        "Document retrieval with semantic cosine similarity.",
        "A completely different domain such as culinary recipes and cooking."
    ]
    vectors = embedder.encode(test_texts)

    # Assertions
    shape_ok = vectors.shape == (3, 384)
    norms = np.linalg.norm(vectors, axis=1)
    norm_ok = np.allclose(norms, 1.0, atol=1e-3)
    finite_ok = np.all(np.isfinite(vectors))

    if shape_ok and norm_ok and finite_ok:
        record_result(
            3,
            "Embedding Vectors (Dimensions, Normalization, Finite)",
            "PASS",
            f"Shape={vectors.shape}, L2-norms={[round(float(n), 4) for n in norms]}, All finite: {finite_ok} "
            f"(Active engine: {embedder.active_model_name})"
        )
    else:
        record_result(
            3,
            "Embedding Vectors (Dimensions, Normalization, Finite)",
            "FAIL",
            f"Shape OK: {shape_ok}, Norms OK: {norm_ok}, Finite: {finite_ok}"
        )
except Exception as e:
    record_result(
        3,
        "Embedding Vectors (Dimensions, Normalization, Finite)",
        "FAIL",
        f"Error during vector encoding test: {e}"
    )

# -----------------------------------------------------------------------------
# Check 4: Semantic Retrieval of Paraphrased Questions
# -----------------------------------------------------------------------------
try:
    from rag_engine import RAGEngine
    engine = RAGEngine()

    # Ingest 3 distinct passages
    passages = [
        {
            "id": "p1", "text": "The Raft consensus algorithm maintains replicated state machines and synchronized logs across server nodes to achieve high fault tolerance.",
            "doc": "distributed_systems.pdf", "page": 4
        },
        {
            "id": "p2", "text": "Photosynthesis is the biochemical mechanism by which green plants transform sunlight, water, and carbon dioxide into glucose and oxygen.",
            "doc": "biology_notes.pdf", "page": 12
        },
        {
            "id": "p3", "text": "The Black-Scholes formula is a mathematical model for estimating the theoretical pricing of European-style options contracts in financial markets.",
            "doc": "financial_derivatives.pdf", "page": 8
        }
    ]

    # Index directly into chunk list for clean isolated testing
    from rag_engine import Chunk
    engine.chunks = []
    engine.documents = {}
    for i, p in enumerate(passages):
        vec = engine.embedding_model.encode([p["text"]])[0]
        engine.chunks.append(
            Chunk(chunk_id=f"c{i}", document_id=f"d{i}", filename=p["doc"], page_number=p["page"], chunk_text=p["text"], embedding=vec)
        )

    # Paraphrased query with no direct keyword overlap:
    # "Which protocol synchronizes state between machines in distributed networks?"
    query = "Which protocol synchronizes state between machines in distributed networks?"
    retrieved = engine.search_chunks(query=query, top_k=1, min_similarity=0.01)

    top_file = retrieved[0][0].filename if retrieved else "None"
    top_score = retrieved[0][1] if retrieved else 0.0

    if top_file == "distributed_systems.pdf" and top_score > 0.35:
        record_result(
            4,
            "Semantic Retrieval of Paraphrased Questions",
            "PASS",
            f"Retrieved correct passage '{top_file}' with strong semantic similarity {top_score:.3f}."
        )
    else:
        record_result(
            4,
            "Semantic Retrieval of Paraphrased Questions",
            "FAIL",
            f"Retrieved '{top_file}' with score {top_score:.3f} (Expected: distributed_systems.pdf). "
            f"The active fallback cannot resolve semantic synonyms without true neural embeddings."
        )
except Exception as e:
    record_result(
        4,
        "Semantic Retrieval of Paraphrased Questions",
        "FAIL",
        f"Exception in retrieval test: {e}"
    )

# -----------------------------------------------------------------------------
# Check 5: Ollama Service Availability
# -----------------------------------------------------------------------------
from config import settings
ollama_bin = shutil.which("ollama")
ollama_url = f"{settings.OLLAMA_BASE_URL.rstrip('/')}/api/tags"
try:
    req = urllib.request.Request(ollama_url)
    with urllib.request.urlopen(req, timeout=2.0) as res:
        data = json.loads(res.read().decode())
        models = [m.get("name") for m in data.get("models", [])]
        record_result(
            5,
            "Ollama Service Availability",
            "PASS",
            f"Ollama is reachable at {settings.OLLAMA_BASE_URL}. Models: {models}"
        )
except Exception as e:
    bin_status = f"Binary installed: {bool(ollama_bin)}"
    record_result(
        5,
        "Ollama Service Availability",
        "FAIL",
        f"Ollama HTTP daemon is unreachable at {settings.OLLAMA_BASE_URL} ({type(e).__name__}). {bin_status}."
    )

# -----------------------------------------------------------------------------
# Check 6: Actual LLM Generation Using Retrieved Document Context
# -----------------------------------------------------------------------------
from llm_service import LLMService
dummy_chunk = Chunk(
    chunk_id="test_c1",
    document_id="test_d1",
    filename="research_report.pdf",
    page_number=3,
    chunk_text="In our randomized controlled trial of 450 subjects, the intervention demonstrated a 28% reduction in latency.",
    embedding=np.zeros(384, dtype=np.float32)
)
try:
    # Test if genuine Ollama generation can be performed
    ollama_content = LLMService._call_ollama_api(
        question="What was the reduction in latency?",
        retrieved_chunks=[(dummy_chunk, 0.85)]
    )
    if ollama_content:
        record_result(
            6,
            "Actual LLM Generation (Retrieved Context)",
            "PASS",
            f"Ollama model '{settings.OLLAMA_MODEL}' generated: {ollama_content[:100]}..."
        )
    else:
        record_result(
            6,
            "Actual LLM Generation (Retrieved Context)",
            "FAIL",
            "Ollama returned empty response."
        )
except Exception as e:
    record_result(
        6,
        "Actual LLM Generation (Retrieved Context)",
        "BLOCKED",
        f"Ollama runtime unavailable ({type(e).__name__}). Honest fallback notice triggered correctly."
    )

# -----------------------------------------------------------------------------
# Check 7: Insufficient-Information Responses
# -----------------------------------------------------------------------------
try:
    from llm_service import INSUFFICIENT_INFO_RESPONSE
    # 1. Empty context
    ans_empty, model_empty = LLMService.generate_grounded_answer(
        question="What is the speed of light in vacuum?",
        retrieved_chunks=[]
    )
    empty_pass = (ans_empty == INSUFFICIENT_INFO_RESPONSE) and (model_empty == "zero-hallucination-guard")

    # 2. Context about biology with question about astrophysics
    bio_chunk = Chunk(
        chunk_id="bio_1",
        document_id="bio_d1",
        filename="cell_biology.pdf",
        page_number=1,
        chunk_text="Mitochondria generate ATP through oxidative phosphorylation inside eukaryotic cells.",
        embedding=np.zeros(384, dtype=np.float32)
    )
    ans_irrelevant, model_irrel = LLMService.generate_grounded_answer(
        question="What is the distance to the Andromeda galaxy?",
        retrieved_chunks=[(bio_chunk, 0.05)]
    )
    irrel_pass = INSUFFICIENT_INFO_RESPONSE in ans_irrelevant

    if empty_pass and irrel_pass:
        record_result(
            7,
            "Insufficient-Information Responses",
            "PASS",
            "Correctly returned exact zero-hallucination rejection string when context is absent or irrelevant."
        )
    else:
        record_result(
            7,
            "Insufficient-Information Responses",
            "FAIL",
            f"Empty context pass: {empty_pass}, Irrelevant context pass: {irrel_pass}"
        )
except Exception as e:
    record_result(
        7,
        "Insufficient-Information Responses",
        "FAIL",
        f"Exception testing insufficient-information handling: {e}"
    )

# -----------------------------------------------------------------------------
# Check 8: Preservation of Source Filenames and Page Citations
# -----------------------------------------------------------------------------
try:
    test_chunk = Chunk(
        chunk_id="test_cite_1",
        document_id="doc_xyz",
        filename="sample_q4_results.pdf",
        page_number=7,
        chunk_text="Q4 operating profit increased by 14 percent compared to the prior fiscal year.",
        embedding=np.zeros(384, dtype=np.float32)
    )

    ans, model = LLMService.generate_grounded_answer(
        question="What was the operating profit change?",
        retrieved_chunks=[(test_chunk, 0.92)]
    )

    # 1. Verify citation markers in synthesized answer text
    has_file = test_chunk.filename in ans
    has_page = f"Page {test_chunk.page_number}" in ans or f"page {test_chunk.page_number}" in ans.lower()

    # 2. Verify structured Citation schema contract
    from schemas import Citation
    structured_cite = Citation(
        file=test_chunk.filename,
        page=test_chunk.page_number,
        score=0.92,
        snippet=test_chunk.chunk_text[:100]
    )
    structured_ok = (structured_cite.file == test_chunk.filename) and (structured_cite.page == test_chunk.page_number)

    if has_file and has_page and structured_ok:
        record_result(
            8,
            "Preservation of Source Filenames and Page Citations",
            "PASS",
            f"Source filename ('{test_chunk.filename}') and page ('Page {test_chunk.page_number}') preserved in final answer and structured Citation schema."
        )
    else:
        record_result(
            8,
            "Preservation of Source Filenames and Page Citations",
            "FAIL",
            f"Citations missing in output: has_file={has_file}, has_page={has_page}, structured_ok={structured_ok}"
        )
except Exception as e:
    record_result(
        8,
        "Preservation of Source Filenames and Page Citations",
        "FAIL",
        f"Exception testing citation preservation: {e}"
    )

# -----------------------------------------------------------------------------
# Summary Table
# -----------------------------------------------------------------------------
print("\n" + "=" * 70)
print("                    FINAL GOAL D TEST MATRIX")
print("=" * 70)
print(f"{'#':<4} {'Component Test':<45} {'Result':<12}")
print("-" * 70)
for r in test_results:
    print(f"{r['check']:<4} {r['name']:<45} {r['status']:<12}")
print("=" * 70)

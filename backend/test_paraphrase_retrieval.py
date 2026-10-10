"""
Empirical Evaluation: Test Paraphrase Semantic Retrieval
Tests whether the current fallback embedding mechanism can retrieve
passages when queries use semantic paraphrases instead of exact keyword matches.
"""

from rag_engine import EmbeddingModel, Chunk
import numpy as np

def run_paraphrase_test():
    print("=" * 60)
    print("🧪 EMPIRICAL PARAPHRASE RETRIEVAL BENCHMARK")
    print("=" * 60)

    model = EmbeddingModel()
    print(f"Active Model Instance: {type(model).__name__}")
    print(f"Is SentenceTransformer active? {model._st_model is not None}")

    # Realistic Test Passages
    passages = [
        {
            "id": "doc_medical",
            "title": "Clinical Cardiology Manual",
            "text": (
                "Cardiac Arrest and Emergency Response: In case of acute myocardial "
                "infarction, immediate defibrillation and administration of oxygen are "
                "critical within the first four minutes to prevent irreversible brain hypoxia."
            ),
            "expected_for": "q_heart",
        },
        {
            "id": "doc_travel",
            "title": "Corporate Travel Policy",
            "text": (
                "Corporate Travel Policy: All international flight bookings exceeding one thousand "
                "dollars must receive prior authorization from the department vice president at "
                "least fourteen days prior to departure."
            ),
            "expected_for": "q_travel",
        },
        {
            "id": "doc_database",
            "title": "Database Engineering Handbook",
            "text": (
                "Storage Engine Optimization: B-tree indexes accelerate equality searches "
                "and range scans, but introduce substantial write amplification overhead "
                "during high-throughput bulk ingestion workloads."
            ),
            "expected_for": "q_database",
        },
    ]

    # Paraphrased Test Queries (Little to zero keyword overlap)
    queries = [
        {
            "id": "q_heart",
            "query": "What urgent medical actions are required when someone suffers a severe heart attack?",
            "expected_id": "doc_medical",
        },
        {
            "id": "q_travel",
            "query": "Do employees need managerial approval for expensive overseas plane tickets?",
            "expected_id": "doc_travel",
        },
        {
            "id": "q_database",
            "query": "How do indexing trees impact high-volume record additions?",
            "expected_id": "doc_database",
        },
    ]

    # Encode passages
    passage_texts = [p["text"] for p in passages]
    passage_vecs = model.encode(passage_texts)

    results = []

    for q in queries:
        q_vec = model.encode([q["query"]])[0]
        # Cosine similarity
        scores = np.dot(passage_vecs, q_vec)
        ranked_indices = np.argsort(scores)[::-1]
        top_idx = ranked_indices[0]
        top_passage = passages[top_idx]
        top_score = scores[top_idx]

        is_match = top_passage["id"] == q["expected_id"]
        results.append({
            "query": q["query"],
            "expected": q["expected_id"],
            "retrieved": top_passage["id"],
            "retrieved_score": float(top_score),
            "all_scores": [float(s) for s in scores],
            "is_match": is_match,
            "top_passage_text": top_passage["text"][:100] + "..."
        })

    print("\nBenchmark Results:")
    for i, r in enumerate(results, 1):
        print(f"\nQuery {i}: \"{r['query']}\"")
        print(f"  Expected: {r['expected']}")
        print(f"  Retrieved: {r['retrieved']} (Score: {r['retrieved_score']:.4f})")
        print(f"  All Scores: Medical={r['all_scores'][0]:.4f}, Travel={r['all_scores'][1]:.4f}, Database={r['all_scores'][2]:.4f}")
        print(f"  Result: {'✅ SUCCESS' if r['is_match'] else '❌ FAILED'}")

    accuracy = sum(1 for r in results if r["is_match"]) / len(results) * 100
    print(f"\nOverall Paraphrase Retrieval Accuracy: {accuracy:.1f}%")

if __name__ == "__main__":
    run_paraphrase_test()

from fastapi.testclient import TestClient
from app.main import app

def main():
    print("Testing Kivo AI Backend with FastAPI TestClient...")
    with TestClient(app) as client:
        # 1. Root
        r1 = client.get("/")
        assert r1.status_code == 200, f"Root failed: {r1.status_code}"
        print(f"✅ Root endpoint: OK ({r1.json()['project']})")

        # 2. Health
        r2 = client.get("/api/health")
        assert r2.status_code == 200, f"Health failed: {r2.status_code}"
        h_data = r2.json()
        print(f"✅ Health endpoint: OK (Status: {h_data['status']}, Chunks: {h_data['total_chunks']}, Engine: {h_data['vector_engine']})")

        # 3. Documents
        r3 = client.get("/api/documents")
        assert r3.status_code == 200
        docs = r3.json()
        print(f"✅ Documents list: OK ({len(docs)} documents indexed)")
        for doc in docs:
            print(f"   • {doc['name']} ({doc['pages']} pages, {doc['chunks_count']} chunks)")

        # 4. RAG Chat Query
        q = "What does Section 3.2 say about data provenance and verification?"
        r4 = client.post("/api/chat/query", json={"query": q, "top_k": 3})
        assert r4.status_code == 200
        chat = r4.json()
        print(f"\n✅ RAG Query: OK (Latency: {chat['total_time_ms']}ms, Model: {chat['model_used']})")
        print("--- Generated Answer ---")
        print(chat["answer"])
        print("--- Verified Citations ---")
        for c in chat["citations"]:
            print(f"   • File: {c['file']} | Page: {c['page']} | Relevance: {round(c['score'] * 100, 1)}%")

    print("\n🎉 ALL BACKEND CHECKS PASSED PERFECTLY!")

if __name__ == "__main__":
    main()

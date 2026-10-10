import math
import re
from typing import Dict, List, Tuple
import numpy as np
from app.models.schemas import ChunkMetadata

# Curated English stop words list
STOP_WORDS = {
    "a", "about", "above", "after", "again", "against", "all", "am", "an", "and", "any",
    "are", "aren't", "as", "at", "be", "because", "been", "before", "being", "below",
    "between", "both", "but", "by", "can't", "cannot", "could", "couldn't", "did",
    "didn't", "do", "does", "doesn't", "doing", "don't", "down", "during", "each", "few",
    "for", "from", "further", "had", "hadn't", "has", "hasn't", "have", "haven't",
    "having", "he", "he'd", "he'll", "he's", "her", "here", "here's", "hers", "herself",
    "him", "himself", "his", "how", "how's", "i", "i'd", "i'll", "i'm", "i've", "if",
    "in", "into", "is", "isn't", "it", "it's", "its", "itself", "let's", "me", "more",
    "most", "mustn't", "my", "myself", "no", "nor", "not", "of", "off", "on", "once",
    "only", "or", "other", "ought", "our", "ours", "ourselves", "out", "over", "own",
    "same", "shan't", "she", "she'd", "she'll", "she's", "should", "shouldn't", "so",
    "some", "such", "than", "that", "that's", "the", "their", "theirs", "them", "themselves",
    "then", "there", "there's", "these", "they", "they'd", "they'll", "they're", "they've",
    "this", "those", "through", "to", "too", "under", "until", "up", "very", "was",
    "wasn't", "we", "we'd", "we'll", "we're", "we've", "were", "weren't", "what",
    "what's", "when", "when's", "where", "where's", "which", "while", "who", "who's",
    "whom", "why", "why's", "with", "won't", "would", "wouldn't", "you", "you'd",
    "you'll", "you're", "you've", "your", "yours", "yourself", "yourselves"
}


class NumpyVectorEngine:
    """
    High-performance Vector Space Engine implemented using pure NumPy.
    Implements TF-IDF vectorization with sublinear scaling, smooth IDF,
    L2 normalization, and vectorized Cosine Similarity matrix multiplication.
    """

    def __init__(self):
        self.chunks: List[ChunkMetadata] = []
        self.vocab: Dict[str, int] = {}          # token -> index
        self.idf: np.ndarray = np.array([])       # IDF vector shape (V,)
        self.chunk_matrix: np.ndarray = np.array([[]])  # shape (N, V)
        self.is_indexed: bool = False

    @staticmethod
    def tokenize(text: str) -> List[str]:
        """Extracts normalized words, filtering out short tokens and common stop words."""
        tokens = re.findall(r"\b[a-zA-Z0-9_\-]{2,}\b", text.lower())
        return [t for t in tokens if t not in STOP_WORDS]

    def add_chunks(self, new_chunks: List[ChunkMetadata]) -> None:
        """Adds new chunks and recalculates the vector index."""
        self.chunks.extend(new_chunks)
        self.rebuild_index()

    def remove_document(self, doc_id: str) -> int:
        """Removes all chunks associated with a document ID and rebuilds index."""
        initial_len = len(self.chunks)
        self.chunks = [c for c in self.chunks if c.doc_id != doc_id]
        removed_count = initial_len - len(self.chunks)
        self.rebuild_index()
        return removed_count

    def clear(self) -> None:
        """Clears all stored chunks and index."""
        self.chunks.clear()
        self.vocab.clear()
        self.idf = np.array([])
        self.chunk_matrix = np.array([[]])
        self.is_indexed = False

    def rebuild_index(self) -> None:
        """
        Reconstructs the TF-IDF vocabulary, IDF weights, and L2-normalized
        NumPy matrix for all active chunks in memory.
        """
        if not self.chunks:
            self.vocab.clear()
            self.idf = np.array([])
            self.chunk_matrix = np.array([[]])
            self.is_indexed = False
            return

        # 1. Tokenize all chunks & build document frequencies
        doc_frequencies: Dict[str, int] = {}
        chunk_token_lists: List[List[str]] = []

        for chunk in self.chunks:
            tokens = self.tokenize(chunk.text)
            chunk_token_lists.append(tokens)
            unique_tokens = set(tokens)
            for t in unique_tokens:
                doc_frequencies[t] = doc_frequencies.get(t, 0) + 1

        # 2. Build Vocabulary map
        sorted_tokens = sorted(doc_frequencies.keys())
        self.vocab = {token: idx for idx, token in enumerate(sorted_tokens)}
        vocab_size = len(self.vocab)
        num_chunks = len(self.chunks)

        if vocab_size == 0:
            self.is_indexed = False
            return

        # 3. Calculate Smooth IDF: log((N + 1) / (DF + 1)) + 1
        idf_values = np.zeros(vocab_size, dtype=np.float32)
        for token, idx in self.vocab.items():
            df = doc_frequencies[token]
            idf_values[idx] = math.log((num_chunks + 1.0) / (df + 1.0)) + 1.0
        self.idf = idf_values

        # 4. Construct Chunk TF-IDF Matrix (N x V)
        matrix = np.zeros((num_chunks, vocab_size), dtype=np.float32)

        for row_idx, tokens in enumerate(chunk_token_lists):
            token_counts: Dict[str, int] = {}
            for t in tokens:
                token_counts[t] = token_counts.get(t, 0) + 1

            for token, count in token_counts.items():
                if token in self.vocab:
                    col_idx = self.vocab[token]
                    # Sublinear TF: 1 + log(tf)
                    tf = 1.0 + math.log(count)
                    matrix[row_idx, col_idx] = tf * self.idf[col_idx]

        # 5. Apply L2-Normalization along rows: ||v||_2 = 1.0
        row_norms = np.linalg.norm(matrix, axis=1, keepdims=True)
        # Avoid division by zero with small epsilon
        row_norms[row_norms == 0] = 1e-9
        self.chunk_matrix = matrix / row_norms
        self.is_indexed = True

    def search(
        self,
        query: str,
        top_k: int = 4,
        doc_id_filter: str | None = None,
        min_similarity: float = 0.01,
    ) -> List[Tuple[ChunkMetadata, float]]:
        """
        Executes NumPy-vectorized Cosine Similarity search:
        Sim(Q, D) = (Q_norm . D_norm)
        """
        if not self.is_indexed or not self.chunks or len(self.vocab) == 0:
            return []

        query_tokens = self.tokenize(query)
        if not query_tokens:
            return []

        # 1. Build Query Vector
        query_vec = np.zeros(len(self.vocab), dtype=np.float32)
        query_counts: Dict[str, int] = {}
        for t in query_tokens:
            query_counts[t] = query_counts.get(t, 0) + 1

        for token, count in query_counts.items():
            if token in self.vocab:
                col_idx = self.vocab[token]
                tf = 1.0 + math.log(count)
                query_vec[col_idx] = tf * self.idf[col_idx]

        # L2-normalize query vector
        q_norm = np.linalg.norm(query_vec)
        if q_norm == 0:
            return []
        query_vec = query_vec / q_norm

        # 2. Vectorized Cosine Similarity via NumPy Dot Product: (N, V) x (V,) -> (N,)
        cosine_scores = np.dot(self.chunk_matrix, query_vec)

        # 3. Filter and Sort Results
        candidate_indices = np.argsort(cosine_scores)[::-1]
        results: List[Tuple[ChunkMetadata, float]] = []

        for idx in candidate_indices:
            score = float(cosine_scores[idx])
            if score < min_similarity:
                break

            chunk = self.chunks[idx]
            if doc_id_filter and chunk.doc_id != doc_id_filter:
                continue

            results.append((chunk, score))
            if len(results) >= top_k:
                break

        return results

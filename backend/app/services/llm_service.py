import json
import re
from typing import List, Tuple
import requests
from app.models.schemas import ChunkMetadata
from app.config import settings


class LLMService:
    """
    Dual-mode Grounded RAG Generation Service:
    - Mode A: Offline Zero-Hallucination Extractive Synthesizer (Fast, reliable, zero cost).
    - Mode B: Cloud LLM (Google Gemini or OpenAI) if API keys are supplied in environment.
    """

    @classmethod
    def generate_answer(
        cls,
        query: str,
        retrieved_chunks: List[Tuple[ChunkMetadata, float]],
    ) -> Tuple[str, str]:
        """
        Generates an answer based on query and retrieved chunks.
        Returns: (answer_text, model_name_used)
        """
        if not retrieved_chunks:
            return (
                "No relevant passages were found in the uploaded documents. "
                "Please upload a relevant PDF or refine your query.",
                "zero-hallucination-guard",
            )

        # Check for Groq API Key
        if settings.GROQ_API_KEY:
            try:
                groq_answer = cls._call_groq_api(query, retrieved_chunks)
                if groq_answer:
                    return groq_answer, f"groq-{settings.GROQ_MODEL}"
            except Exception as e:
                print(f"[LLMService] Groq API call fallback: {e}")

        # Check for Gemini API Key
        if settings.GEMINI_API_KEY:
            try:
                gemini_answer = cls._call_gemini_api(query, retrieved_chunks)
                if gemini_answer:
                    return gemini_answer, "gemini-1.5-flash"
            except Exception as e:
                print(f"[LLMService] Gemini API call fallback: {e}")

        # Check for OpenAI API Key
        if settings.OPENAI_API_KEY:
            try:
                openai_answer = cls._call_openai_api(query, retrieved_chunks)
                if openai_answer:
                    return openai_answer, "openai-gpt-4o-mini"
            except Exception as e:
                print(f"[LLMService] OpenAI API call fallback: {e}")

        # Default Mode: Built-in Grounded Extractive Synthesizer
        local_answer = cls._synthesize_local_grounded_answer(query, retrieved_chunks)
        return local_answer, "kivo-grounded-extractor-v1"

    @classmethod
    def _synthesize_local_grounded_answer(
        cls, query: str, retrieved_chunks: List[Tuple[ChunkMetadata, float]]
    ) -> str:
        """
        Synthesizes a structured, highly readable response directly from the top passages.
        Preserves academic provenance with page citations and zero hallucination.
        """
        top_chunk, top_score = retrieved_chunks[0]

        # Break top chunks into sentences and rank relevance
        ranked_sentences = []
        query_words = set(re.findall(r"\b\w{3,}\b", query.lower()))

        for chunk, score in retrieved_chunks:
            sentences = re.split(r"(?<=[.!?])\s+", chunk.text)
            for s in sentences:
                s_clean = s.strip()
                if len(s_clean.split()) < 4:
                    continue
                s_words = set(re.findall(r"\b\w{3,}\b", s_clean.lower()))
                overlap = len(query_words.intersection(s_words))
                if overlap > 0:
                    ranked_sentences.append((overlap * score, chunk.doc_name, chunk.page, s_clean))

        ranked_sentences.sort(key=lambda x: x[0], reverse=True)

        # Assemble the answer
        output_lines = []
        output_lines.append(
            f"Based on **{top_chunk.doc_name}** (Page {top_chunk.page}) and related retrieved context:"
        )
        output_lines.append("")

        if ranked_sentences:
            seen_sentences = set()
            selected = []
            for _, doc, page, sent in ranked_sentences:
                if sent not in seen_sentences:
                    seen_sentences.add(sent)
                    selected.append((doc, page, sent))
                if len(selected) >= 3:
                    break

            for doc, page, sent in selected:
                output_lines.append(f"• {sent} *[{doc}, Page {page}]*")
        else:
            # Fallback to top chunk snippet if sentences didn't split cleanly
            summary_snippet = " ".join(top_chunk.text.split()[:50]) + "..."
            output_lines.append(f"• {summary_snippet} *[{top_chunk.doc_name}, Page {top_chunk.page}]*")

        output_lines.append("")
        output_lines.append(
            f"*(Confidence match: {top_score * 100:.1f}% across {len(retrieved_chunks)} relevant sections)*"
        )

        return "\n".join(output_lines)

    @classmethod
    def _call_groq_api(
        cls, query: str, retrieved_chunks: List[Tuple[ChunkMetadata, float]]
    ) -> str:
        context_blocks = []
        for idx, (chunk, score) in enumerate(retrieved_chunks, 1):
            context_blocks.append(
                f"[Source {idx}]: File: {chunk.doc_name}, Page: {chunk.page}\nContent: {chunk.text}\n"
            )

        context_str = "\n".join(context_blocks)
        system_prompt = (
            "You are Kivo AI, a precise academic assistant. "
            "Answer the user query based ONLY on the provided context passages. "
            "Always cite the exact file name and page number for facts stated in this format: [filename, Page X]. "
            "If the context does not contain enough information, state that honestly."
        )
        user_prompt = f"CONTEXT PASSAGES:\n{context_str}\n\nUSER QUERY: {query}\n\nANSWER:"

        try:
            from groq import Groq
            client = Groq(api_key=settings.GROQ_API_KEY)
            completion = client.chat.completions.create(
                model=settings.GROQ_MODEL,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=0.2,
                max_tokens=1024,
            )
            return completion.choices[0].message.content.strip()
        except Exception:
            url = "https://api.groq.com/openai/v1/chat/completions"
            headers = {
                "Authorization": f"Bearer {settings.GROQ_API_KEY}",
                "Content-Type": "application/json",
            }
            payload = {
                "model": settings.GROQ_MODEL,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                "temperature": 0.2,
                "max_tokens": 1024,
            }
            res = requests.post(url, headers=headers, json=payload, timeout=20)
            res.raise_for_status()
            data = res.json()
            return data["choices"][0]["message"]["content"].strip()

    @classmethod
    def _call_gemini_api(
        cls, query: str, retrieved_chunks: List[Tuple[ChunkMetadata, float]]
    ) -> str:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={settings.GEMINI_API_KEY}"
        headers = {"Content-Type": "application/json"}

        context_blocks = []
        for idx, (chunk, score) in enumerate(retrieved_chunks, 1):
            context_blocks.append(
                f"[Source {idx}]: File: {chunk.doc_name}, Page: {chunk.page}\nContent: {chunk.text}\n"
            )

        context_str = "\n".join(context_blocks)
        prompt = (
            "You are Kivo AI, a precise academic assistant. "
            "Answer the user query based ONLY on the provided context passages. "
            "Always cite the exact file name and page number for facts stated. "
            "If the context does not contain enough information, state that honestly.\n\n"
            f"CONTEXT PASSAGES:\n{context_str}\n\n"
            f"USER QUERY: {query}\n\n"
            "ANSWER:"
        )

        payload = {"contents": [{"parts": [{"text": prompt}]}]}
        res = requests.post(url, headers=headers, json=payload, timeout=12)
        res.raise_for_status()
        data = res.json()
        return data["candidates"][0]["content"]["parts"][0]["text"].strip()

    @classmethod
    def _call_openai_api(
        cls, query: str, retrieved_chunks: List[Tuple[ChunkMetadata, float]]
    ) -> str:
        url = "https://api.openai.com/v1/chat/completions"
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {settings.OPENAI_API_KEY}",
        }

        context_blocks = []
        for idx, (chunk, score) in enumerate(retrieved_chunks, 1):
            context_blocks.append(
                f"[Source {idx}]: File: {chunk.doc_name}, Page: {chunk.page}\n{chunk.text}\n"
            )

        context_str = "\n".join(context_blocks)
        payload = {
            "model": "gpt-4o-mini",
            "messages": [
                {
                    "role": "system",
                    "content": (
                        "You are Kivo AI, an academic document assistant. Answer using ONLY the provided context. "
                        "Cite exact page numbers. If unsure, say you do not know."
                    ),
                },
                {"role": "user", "content": f"Context:\n{context_str}\n\nQuestion: {query}"},
            ],
            "temperature": 0.2,
        }

        res = requests.post(url, headers=headers, json=payload, timeout=12)
        res.raise_for_status()
        data = res.json()
        return data["choices"][0]["message"]["content"].strip()

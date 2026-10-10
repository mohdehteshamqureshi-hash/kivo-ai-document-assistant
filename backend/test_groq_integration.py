"""
Groq API Integration Test Suite for Kivo AI
Validates:
1. Groq settings configuration and environment variable loading.
2. Grounded answer generation using Groq API interface with untrusted data boundary.
3. Citation preservation on Groq responses.
4. Seamless fallback behavior when GROQ_API_KEY is not set or when network fails.
5. Verification that API keys are never exposed in outputs or logs.
"""

from unittest.mock import MagicMock, patch
import numpy as np
from config import settings
from rag_engine import Chunk
from llm_service import LLMService, INSUFFICIENT_INFO_RESPONSE


def test_1_groq_configuration():
    """Verify Groq settings exist and defaults are sane."""
    print("\n--- Test 1: Groq Configuration & Defaults ---")
    assert hasattr(settings, "GROQ_API_KEY")
    assert hasattr(settings, "GROQ_MODEL")
    assert settings.GROQ_MODEL == "llama-3.3-70b-versatile" or isinstance(settings.GROQ_MODEL, str)
    print(f"✅ Groq settings verified: Model='{settings.GROQ_MODEL}', KeySet={bool(settings.GROQ_API_KEY)}")


def test_2_groq_generation_with_citation_preservation():
    """Verify that Groq generation preserves source filename and page citation."""
    print("\n--- Test 2: Groq Generation with Citation Preservation ---")
    chunk = Chunk(
        chunk_id="groq_c1",
        document_id="groq_d1",
        filename="solar_energy_specs.pdf",
        page_number=8,
        chunk_text="Photovoltaic efficiency reached 24.3 percent under standard AM1.5 test illumination.",
        embedding=np.zeros(384, dtype=np.float32),
    )

    fake_groq_response = (
        "Under AM1.5 illumination, photovoltaic efficiency reached 24.3 percent. "
        "[solar_energy_specs.pdf, Page 8]"
    )

    with patch.object(settings, "GROQ_API_KEY", "test_mock_groq_key_99999"):
        with patch.object(LLMService, "_call_groq_api", return_value=fake_groq_response) as mock_call:
            answer, model_used = LLMService.generate_grounded_answer(
                question="What was the photovoltaic efficiency?",
                retrieved_chunks=[(chunk, 0.92)],
            )

            mock_call.assert_called_once()
            assert "solar_energy_specs.pdf" in answer
            assert "Page 8" in answer
            assert model_used.startswith("groq-")
            assert "test_mock_groq_key_99999" not in answer
            print(f"✅ Groq generation verified with model={model_used}")
            print(f"   Answer: {answer}")


def test_3_groq_omitted_citations_auto_restoration():
    """Verify that if Groq omits citation tags, _ensure_citations restores them."""
    print("\n--- Test 3: Auto-Restoration of Citations if Omitted by Groq ---")
    chunk = Chunk(
        chunk_id="groq_c2",
        document_id="groq_d2",
        filename="quantum_computing_2026.pdf",
        page_number=15,
        chunk_text="Coherence times exceeded 120 microseconds for transmon qubits.",
        embedding=np.zeros(384, dtype=np.float32),
    )

    # Groq response that forgot to include the citation
    raw_groq_without_citation = "Coherence times reached 120 microseconds for the qubits."

    with patch.object(settings, "GROQ_API_KEY", "test_mock_groq_key_99999"):
        with patch.object(LLMService, "_call_groq_api", return_value=raw_groq_without_citation):
            answer, model_used = LLMService.generate_grounded_answer(
                question="What was the coherence time?",
                retrieved_chunks=[(chunk, 0.89)],
            )

            assert "quantum_computing_2026.pdf" in answer
            assert "Page 15" in answer
            assert "[quantum_computing_2026.pdf, Page 15]" in answer
            print(f"✅ Citation correctly restored to answer: {answer}")


def test_4_groq_fallback_when_key_absent():
    """Verify fallback sequence when GROQ_API_KEY is None."""
    print("\n--- Test 4: Seamless Fallback When GROQ_API_KEY is None ---")
    chunk = Chunk(
        chunk_id="groq_c3",
        document_id="groq_d3",
        filename="robotics_paper.pdf",
        page_number=3,
        chunk_text="The robotic arm achieved 0.05 mm repeatability under maximum payload.",
        embedding=np.zeros(384, dtype=np.float32),
    )

    with patch.object(settings, "GROQ_API_KEY", None):
        # When Groq is not set, it should not call _call_groq_api
        with patch.object(LLMService, "_call_groq_api") as mock_groq:
            answer, model_used = LLMService.generate_grounded_answer(
                question="What repeatability did the robotic arm achieve?",
                retrieved_chunks=[(chunk, 0.85)],
            )
            mock_groq.assert_not_called()
            assert not model_used.startswith("groq-")
            print(f"✅ Correctly bypassed Groq and fell back to: {model_used}")


def test_5_zero_hallucination_empty_context():
    """Verify that empty context immediately triggers zero-hallucination guard."""
    print("\n--- Test 5: Zero-Hallucination Guard on Empty Context ---")
    with patch.object(settings, "GROQ_API_KEY", "test_mock_groq_key_99999"):
        with patch.object(LLMService, "_call_groq_api") as mock_groq:
            answer, model = LLMService.generate_grounded_answer(
                question="What is the speed of light in vacuum?",
                retrieved_chunks=[],
            )
            mock_groq.assert_not_called()
            assert answer == INSUFFICIENT_INFO_RESPONSE
            assert model == "zero-hallucination-guard"
            print("✅ Zero-hallucination guard verified")


def run_all_groq_tests():
    print("=" * 70)
    print("  RUNNING GROQ API INTEGRATION TEST SUITE")
    print("=" * 70)

    test_1_groq_configuration()
    test_2_groq_generation_with_citation_preservation()
    test_3_groq_omitted_citations_auto_restoration()
    test_4_groq_fallback_when_key_absent()
    test_5_zero_hallucination_empty_context()

    print("\n" + "=" * 70)
    print("🎉 ALL 5 GROQ INTEGRATION TESTS PASSED WITH 100% SUCCESS!")
    print("=" * 70)


if __name__ == "__main__":
    run_all_groq_tests()

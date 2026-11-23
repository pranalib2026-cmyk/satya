"""Comprehensive test suite for Gemini LLM Provider, Grounded Generation, and Safety Safeguards."""

import json
import unittest.mock as mock
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.modules.legal_assistant.llm_provider import (
    BaseLLMProvider,
    DeterministicGroundedLLMProvider,
    GeminiLLMProvider,
    GroundedLegalAnswerSchema,
    get_llm_provider,
    reset_llm_provider,
)
from app.modules.legal_assistant.schemas import LegalAskRequest
from app.modules.legal_assistant.service import LegalAssistantService
from app.modules.legal_knowledge.ingestion import LegalIngestionService


@pytest.fixture(autouse=True)
def clean_llm_singletons():
    """Reset LLM provider singleton before and after each test."""
    reset_llm_provider()
    yield
    reset_llm_provider()


SAMPLE_CHUNKS = [
    {
        "source_title": "Negotiable Instruments Act, 1881",
        "source_type": "BARE_ACT",
        "act_or_judgment_identifier": "Act No. 26 of 1881",
        "section_number": "Section 138",
        "clause_heading": "Dishonour of cheque for insufficiency, etc., of funds in the account",
        "chunk_text": "Where any cheque drawn by a person on an account maintained by him with a banker for payment of any amount of money...",
        "official_source_url": "https://www.indiacode.nic.in/handle/123456789/2189",
        "content_checksum": "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
    }
]


# ──────────────────────────────────────────────────────────────
# 1. Provider Initialization & Properties
# ──────────────────────────────────────────────────────────────

def test_gemini_llm_provider_initialization():
    """Verify GeminiLLMProvider correctly initializes with gemini-2.5-flash and exposes correct properties."""
    with mock.patch("google.genai.Client") as mock_client_cls:
        mock_instance = mock.MagicMock()
        mock_client_cls.return_value = mock_instance

        provider = GeminiLLMProvider(
            api_key="AIzaSyTestKeyForLLMTesting123",
            model_name="gemini-2.5-flash",
        )

        assert provider.model_name == "gemini-2.5-flash"
        assert provider.provider_name == "GeminiLLMProvider(gemini-2.5-flash)"
        assert provider.is_mock is False
        assert provider.is_live is True
        mock_client_cls.assert_called_once_with(api_key="AIzaSyTestKeyForLLMTesting123")


def test_deterministic_mock_llm_provider_properties():
    """Verify DeterministicGroundedLLMProvider exposes correct mock metadata."""
    mock_provider = DeterministicGroundedLLMProvider()
    assert mock_provider.is_mock is True
    assert mock_provider.provider_name == "DeterministicGroundedLLMProvider"


# ──────────────────────────────────────────────────────────────
# 2. Grounded Response Generation with Structured Schema
# ──────────────────────────────────────────────────────────────

def test_gemini_llm_grounded_response_generation():
    """Verify GeminiLLMProvider parses structured JSON output, maps citations to context, and extracts steps."""
    mock_client = mock.MagicMock()
    mock_response_data = {
        "answer": (
            "Under Section 138 of the Negotiable Instruments Act, 1881, when a cheque bounces due to insufficient funds, "
            "the payee must issue a statutory legal demand notice in writing to the drawer within 30 days of receiving the return memo. "
            "The drawer then has 15 days from notice receipt to make payment before a criminal complaint can be filed."
        ),
        "legal_topic": "Negotiable Instruments / Banking Law",
        "sources_found": True,
        "cited_sections": ["Section 138"],
        "suggested_next_steps": [
            "Obtain the original cheque return memo from the bank.",
            "Issue written statutory notice within 30 days.",
            "Consult an empanelled advocate for Magistrate court proceedings.",
        ],
        "limitations_and_missing_facts": [
            "Exact date of receipt of the return memo is required to confirm whether the 30-day statutory notice limitation is active."
        ],
    }

    mock_response = mock.MagicMock()
    mock_response.text = json.dumps(mock_response_data)
    mock_client.models.generate_content.return_value = mock_response

    with mock.patch("google.genai.Client", return_value=mock_client):
        provider = GeminiLLMProvider(api_key="test-key-123")
        result = provider.generate_legal_answer(
            query="My client gave me a cheque which bounced for insufficient funds. What is the procedure?",
            retrieved_chunks=SAMPLE_CHUNKS,
            language="en",
        )

        assert result["sources_found"] is True
        assert "Section 138" in result["answer"]
        assert result["legal_topic"] == "Negotiable Instruments / Banking Law"
        assert len(result["suggested_next_steps"]) == 3
        assert len(result["limitations_and_missing_facts"]) == 1

        # Verify cited references mapped directly to retrieved chunk metadata
        assert len(result["cited_references"]) == 1
        ref = result["cited_references"][0]
        assert ref["source_title"] == "Negotiable Instruments Act, 1881"
        assert ref["section_or_paragraph"] == "Section 138"
        assert ref["content_checksum"] == "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"

        # Verify system instruction and response schema passed to Gemini API
        mock_client.models.generate_content.assert_called_once()
        call_kwargs = mock_client.models.generate_content.call_args.kwargs
        assert call_kwargs["model"] == "gemini-2.5-flash"
        assert call_kwargs["config"].response_mime_type == "application/json"
        assert call_kwargs["config"].response_schema == GroundedLegalAnswerSchema
        assert "STRICT GROUNDING" in call_kwargs["config"].system_instruction


# ──────────────────────────────────────────────────────────────
# 3. Empty Retrieved Context Handling
# ──────────────────────────────────────────────────────────────

def test_gemini_llm_empty_retrieved_chunks_returns_safe_message():
    """When no relevant context chunks are retrieved, the provider must immediately return a safe message without API call."""
    mock_client = mock.MagicMock()

    with mock.patch("google.genai.Client", return_value=mock_client):
        provider = GeminiLLMProvider(api_key="test-key-123")
        result = provider.generate_legal_answer(
            query="What are the maritime regulations in Antarctica?",
            retrieved_chunks=[],
            language="en",
        )

        assert result["sources_found"] is False
        assert "No verified legal sources found" in result["answer"]
        assert result["cited_references"] == []
        assert len(result["suggested_next_steps"]) >= 1

        # API should NOT be called when context is empty
        mock_client.models.generate_content.assert_not_called()


# ──────────────────────────────────────────────────────────────
# 4. Error Handling & Retry on Rate Limit
# ──────────────────────────────────────────────────────────────

def test_gemini_llm_transient_rate_limit_triggers_retry_and_succeeds():
    """A transient HTTP 429 rate limit error must trigger retry and succeed on subsequent attempt."""
    mock_client = mock.MagicMock()
    valid_data = {
        "answer": "Explanation under Consumer Protection Act.",
        "legal_topic": "Consumer Protection",
        "sources_found": True,
        "cited_sections": ["Section 35"],
        "suggested_next_steps": ["File e-Daakhil complaint."],
        "limitations_and_missing_facts": ["Purchase invoice required."],
    }
    valid_resp = mock.MagicMock(text=json.dumps(valid_data))

    mock_client.models.generate_content.side_effect = [
        Exception("429 Resource Exhausted: Rate limit exceeded"),
        valid_resp,
    ]

    with mock.patch("google.genai.Client", return_value=mock_client), \
         mock.patch("time.sleep"):
        
        provider = GeminiLLMProvider(api_key="test-key-123", max_retries=3)
        result = provider.generate_legal_answer(
            query="How to file consumer dispute?",
            retrieved_chunks=SAMPLE_CHUNKS,
        )

        assert result["sources_found"] is True
        assert mock_client.models.generate_content.call_count == 2


def test_gemini_llm_persistent_failure_in_production_raises_without_fake_response():
    """In production, persistent failures must raise RuntimeError and NEVER return fake successful AI responses."""
    prod_settings = Settings(
        ENVIRONMENT="production",
        AI_PROVIDER="gemini",
        GEMINI_API_KEY="test-prod-key-123",
    )

    mock_client = mock.MagicMock()
    mock_client.models.generate_content.side_effect = Exception("503 Service Unavailable / Gateway Timeout")

    with mock.patch("google.genai.Client", return_value=mock_client), \
         mock.patch("time.sleep"), \
         mock.patch("app.modules.legal_assistant.llm_provider.settings", prod_settings):
        
        provider = GeminiLLMProvider(api_key="test-prod-key-123", max_retries=2)
        with pytest.raises(RuntimeError) as exc_info:
            provider.generate_legal_answer(
                query="What is Section 138 NI Act?",
                retrieved_chunks=SAMPLE_CHUNKS,
            )
        assert "Gemini LLM generation failed" in str(exc_info.value)


# ──────────────────────────────────────────────────────────────
# 5. Empty & Malformed Response Handling
# ──────────────────────────────────────────────────────────────

def test_gemini_llm_empty_model_response_handling():
    """An empty model response in production must raise RuntimeError."""
    prod_settings = Settings(
        ENVIRONMENT="production",
        AI_PROVIDER="gemini",
        GEMINI_API_KEY="test-prod-key-123",
    )

    mock_client = mock.MagicMock()
    mock_client.models.generate_content.return_value = mock.MagicMock(text="")

    with mock.patch("google.genai.Client", return_value=mock_client), \
         mock.patch("time.sleep"), \
         mock.patch("app.modules.legal_assistant.llm_provider.settings", prod_settings):
        
        provider = GeminiLLMProvider(api_key="test-prod-key-123", max_retries=1)
        with pytest.raises(RuntimeError) as exc_info:
            provider.generate_legal_answer("query", SAMPLE_CHUNKS)
        assert "Gemini LLM generation failed" in str(exc_info.value)


def test_gemini_llm_malformed_response_handling():
    """A non-JSON corrupted model response in production must raise RuntimeError."""
    prod_settings = Settings(
        ENVIRONMENT="production",
        AI_PROVIDER="gemini",
        GEMINI_API_KEY="test-prod-key-123",
    )

    mock_client = mock.MagicMock()
    mock_client.models.generate_content.return_value = mock.MagicMock(text="THIS_IS_NOT_VALID_JSON_AT_ALL")

    with mock.patch("google.genai.Client", return_value=mock_client), \
         mock.patch("time.sleep"), \
         mock.patch("app.modules.legal_assistant.llm_provider.settings", prod_settings):
        
        provider = GeminiLLMProvider(api_key="test-prod-key-123", max_retries=1)
        with pytest.raises(RuntimeError) as exc_info:
            provider.generate_legal_answer("query", SAMPLE_CHUNKS)
        assert "Gemini LLM generation failed" in str(exc_info.value)


# ──────────────────────────────────────────────────────────────
# 6. Hallucination Detection & Citation Flagging
# ──────────────────────────────────────────────────────────────

def test_gemini_llm_flags_unverified_sections_not_in_retrieved_chunks():
    """If the LLM cites a section not present in retrieved context (e.g. Section 420 IPC), it is flagged as UNKNOWN."""
    mock_client = mock.MagicMock()
    mock_response_data = {
        "answer": "This matter falls under Section 138 NI Act and also constitutes cheating under Section 420.",
        "legal_topic": "Criminal / Cheque Dishonour",
        "sources_found": True,
        "cited_sections": ["Section 138", "Section 420"],  # Section 420 is NOT in SAMPLE_CHUNKS
        "suggested_next_steps": ["Consult advocate."],
        "limitations_and_missing_facts": [],
    }

    mock_client.models.generate_content.return_value = mock.MagicMock(text=json.dumps(mock_response_data))

    with mock.patch("google.genai.Client", return_value=mock_client):
        provider = GeminiLLMProvider(api_key="test-key-123")
        result = provider.generate_legal_answer("cheque bounce", SAMPLE_CHUNKS)

        claimed_refs = result["cited_references"]
        assert len(claimed_refs) == 2

        # 1. Section 138 is verified against SAMPLE_CHUNKS
        sec138_ref = next(r for r in claimed_refs if "138" in r["section_or_paragraph"])
        assert sec138_ref["source_type"] == "BARE_ACT"
        assert sec138_ref["content_checksum"] is not None

        # 2. Section 420 is flagged as UNKNOWN / Unverified
        sec420_ref = next(r for r in claimed_refs if "420" in r["section_or_paragraph"])
        assert sec420_ref["source_type"] == "UNKNOWN"
        assert sec420_ref["content_checksum"] is None


# ──────────────────────────────────────────────────────────────
# 7. End-to-End Service Integration with Gemini LLM
# ──────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_end_to_end_legal_assistant_service_with_gemini_llm(db_session: AsyncSession):
    """Verify LegalAssistantService.ask works with GeminiLLMProvider and registers audit log."""
    await LegalIngestionService.seed_curated_corpus(db_session)

    mock_client = mock.MagicMock()
    mock_llm_data = {
        "answer": "Under Section 138 of the Negotiable Instruments Act, 1881, dishonour of a cheque due to insufficient funds attracts statutory liability.",
        "legal_topic": "Negotiable Instruments",
        "sources_found": True,
        "cited_sections": ["Section 138"],
        "suggested_next_steps": [
            "Send statutory notice within 30 days.",
            "Consult an advocate for filing complaint.",
        ],
        "limitations_and_missing_facts": [
            "Need date of return memo."
        ],
    }
    mock_client.models.generate_content.return_value = mock.MagicMock(text=json.dumps(mock_llm_data))

    gemini_llm = GeminiLLMProvider(api_key="test-key-123")
    gemini_llm._client = mock_client

    with mock.patch("app.modules.legal_assistant.service.get_llm_provider", return_value=gemini_llm):
        payload = LegalAskRequest(
            query="My cheque bounced yesterday due to insufficient funds, what can I do?",
            preferred_language="en",
            max_sources=3,
        )

        response = await LegalAssistantService.ask(
            db=db_session,
            payload=payload,
            ip_address="127.0.0.1",
            user_agent="PytestRunner/1.0",
        )

        assert response.sources_found is True
        assert "Section 138" in response.answer
        assert len(response.citations) >= 1
        assert response.citations[0].section_or_paragraph == "Section 138"
        assert response.citations[0].is_verified_in_corpus is True
        assert len(response.suggested_next_steps) >= 1
        assert "does not constitute formal legal advice" in response.disclaimer

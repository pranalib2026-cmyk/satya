"""Comprehensive test suite for Semantic Embeddings, Google Gemini Provider, and pgvector Integration."""

import math
import unittest.mock as mock
import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.modules.legal_assistant.embedding_provider import (
    BaseEmbeddingProvider,
    DeterministicMockEmbeddingProvider,
    GeminiEmbeddingProvider,
    get_embedding_provider,
    reset_embedding_provider,
)
from app.modules.legal_assistant.retrieval import LegalRetrievalEngine
from app.modules.legal_knowledge.ingestion import LegalIngestionService
from app.modules.legal_knowledge.models import LegalChunk


@pytest.fixture(autouse=True)
def clean_singletons():
    """Reset embedding provider singleton before and after each test."""
    reset_embedding_provider()
    yield
    reset_embedding_provider()


def make_unit_vector(dim: int = 768, seed_val: float = 0.5) -> list[float]:
    """Helper generating a valid unit-normalized 768-D float vector."""
    vec = [seed_val] * dim
    norm = math.sqrt(sum(v * v for v in vec))
    return [round(v / norm, 6) for v in vec]


# ──────────────────────────────────────────────────────────────
# 1. Provider Initialization & Properties
# ──────────────────────────────────────────────────────────────

def test_gemini_embedding_provider_initialization():
    """Verify GeminiEmbeddingProvider correctly sets model, dimension, and provider properties."""
    with mock.patch("google.genai.Client") as mock_client_cls:
        mock_instance = mock.MagicMock()
        mock_client_cls.return_value = mock_instance

        provider = GeminiEmbeddingProvider(
            api_key="AIzaSyTestKeyForEmbeddingTesting123",
            model_name="text-embedding-004",
            dimension=768,
        )

        assert provider.dimension == 768
        assert provider.model_name == "text-embedding-004"
        assert provider.provider_name == "GeminiEmbeddingProvider(text-embedding-004)"
        assert provider.is_mock is False
        assert provider.is_live is True
        mock_client_cls.assert_called_once_with(api_key="AIzaSyTestKeyForEmbeddingTesting123")


def test_mock_embedding_provider_properties():
    """Verify DeterministicMockEmbeddingProvider exposes correct metadata and dimensions."""
    mock_provider = DeterministicMockEmbeddingProvider(dimension=768)
    assert mock_provider.dimension == 768
    assert mock_provider.is_mock is True
    assert mock_provider.provider_name == "DeterministicMockEmbeddingProvider"


# ──────────────────────────────────────────────────────────────
# 2. Correct Vector Dimensions & Task Types
# ──────────────────────────────────────────────────────────────

def test_gemini_embed_query_task_type_and_dimension():
    """Verify embed_query passes task_type='RETRIEVAL_QUERY' and returns valid 768-D vector."""
    mock_client = mock.MagicMock()
    mock_embedding = mock.MagicMock()
    mock_embedding.values = make_unit_vector(768, 0.1)
    mock_response = mock.MagicMock()
    mock_response.embeddings = [mock_embedding]
    mock_client.models.embed_content.return_value = mock_response

    with mock.patch("google.genai.Client", return_value=mock_client):
        provider = GeminiEmbeddingProvider(api_key="test-key-123")
        vector = provider.embed_query("procedure for cheque bounce under section 138")

        assert len(vector) == 768
        # Verify L2 unit normalization (sum of squares is ~1.0)
        norm = math.sqrt(sum(v * v for v in vector))
        assert abs(norm - 1.0) < 0.01

        # Verify google-genai embed_content was called with RETRIEVAL_QUERY
        mock_client.models.embed_content.assert_called_once()
        call_kwargs = mock_client.models.embed_content.call_args.kwargs
        assert call_kwargs["model"] == "text-embedding-004"
        assert call_kwargs["contents"] == "procedure for cheque bounce under section 138"
        assert call_kwargs["config"].task_type == "RETRIEVAL_QUERY"
        assert call_kwargs["config"].output_dimensionality == 768


def test_gemini_embed_document_task_type_and_dimension():
    """Verify embed_document passes task_type='RETRIEVAL_DOCUMENT' and includes title if given."""
    mock_client = mock.MagicMock()
    mock_embedding = mock.MagicMock()
    mock_embedding.values = make_unit_vector(768, 0.2)
    mock_response = mock.MagicMock()
    mock_response.embeddings = [mock_embedding]
    mock_client.models.embed_content.return_value = mock_response

    with mock.patch("google.genai.Client", return_value=mock_client):
        provider = GeminiEmbeddingProvider(api_key="test-key-123")
        vector = provider.embed_document(
            text="Where any cheque drawn by a person on an account...",
            title="Negotiable Instruments Act, 1881",
        )

        assert len(vector) == 768
        norm = math.sqrt(sum(v * v for v in vector))
        assert abs(norm - 1.0) < 0.01

        call_kwargs = mock_client.models.embed_content.call_args.kwargs
        assert call_kwargs["config"].task_type == "RETRIEVAL_DOCUMENT"
        assert call_kwargs["config"].title == "Negotiable Instruments Act, 1881"


# ──────────────────────────────────────────────────────────────
# 3. Query / Document Vector Compatibility
# ──────────────────────────────────────────────────────────────

def test_query_and_document_vector_compatibility():
    """Verify query and document embeddings are strictly compatible in mathematical space."""
    mock_client = mock.MagicMock()

    # Generate two distinct 768-D vectors
    q_vec = make_unit_vector(768, 0.1)
    d_vec = make_unit_vector(768, 0.1)  # Identical for high similarity test

    mock_resp_q = mock.MagicMock(embeddings=[mock.MagicMock(values=q_vec)])
    mock_resp_d = mock.MagicMock(embeddings=[mock.MagicMock(values=d_vec)])

    mock_client.models.embed_content.side_effect = [mock_resp_q, mock_resp_d]

    with mock.patch("google.genai.Client", return_value=mock_client):
        provider = GeminiEmbeddingProvider(api_key="test-key-123")
        q_result = provider.embed_query("cheque bounce")
        d_result = provider.embed_document("Section 138 Dishonour of Cheque")

        assert len(q_result) == len(d_result) == 768

        # Compute dot product (cosine similarity since both unit-normalized)
        dot_product = sum(a * b for a, b in zip(q_result, d_result))
        assert dot_product >= 0.99  # Perfectly aligned test vectors


# ──────────────────────────────────────────────────────────────
# 4. Dimension Mismatch Validation & Malformed Inputs
# ──────────────────────────────────────────────────────────────

def test_embedding_dimension_mismatch_raises_error():
    """If the upstream API returns an unexpected dimension (e.g. 512 instead of 768), raise ValueError."""
    mock_client = mock.MagicMock()
    # Return 512-D vector when 768 is configured
    truncated_vec = [0.1] * 512
    mock_client.models.embed_content.return_value = mock.MagicMock(
        embeddings=[mock.MagicMock(values=truncated_vec)]
    )

    with mock.patch("google.genai.Client", return_value=mock_client):
        provider = GeminiEmbeddingProvider(api_key="test-key-123", dimension=768)
        with pytest.raises(ValueError) as exc_info:
            provider.embed_query("some legal query")
        assert "Embedding dimension mismatch" in str(exc_info.value)
        assert "expected exactly 768 dimensions" in str(exc_info.value)


def test_empty_text_raises_validation_error():
    """Empty or whitespace-only inputs must be rejected before calling API."""
    with mock.patch("google.genai.Client"):
        provider = GeminiEmbeddingProvider(api_key="test-key-123")
        with pytest.raises(ValueError) as exc_q:
            provider.embed_query("   ")
        assert "cannot be empty" in str(exc_q.value)

        with pytest.raises(ValueError) as exc_d:
            provider.embed_document("")
        assert "cannot be empty" in str(exc_d.value)


# ──────────────────────────────────────────────────────────────
# 5. Error Handling & Retry on Rate Limit
# ──────────────────────────────────────────────────────────────

def test_transient_rate_limit_triggers_retry_and_succeeds():
    """A transient HTTP 429 / Resource Exhausted error must trigger retry and succeed."""
    mock_client = mock.MagicMock()
    valid_resp = mock.MagicMock(embeddings=[mock.MagicMock(values=make_unit_vector(768, 0.3))])

    # First attempt raises 429, second attempt succeeds
    mock_client.models.embed_content.side_effect = [
        Exception("429 Resource Exhausted: Rate limit exceeded"),
        valid_resp,
    ]

    with mock.patch("google.genai.Client", return_value=mock_client), \
         mock.patch("time.sleep"):  # Avoid real sleep delay during test
        
        provider = GeminiEmbeddingProvider(api_key="test-key-123", max_retries=3)
        vec = provider.embed_query("procedure for consumer complaint")
        assert len(vec) == 768
        assert mock_client.models.embed_content.call_count == 2


def test_production_fails_fast_on_persistent_error_without_mock_fallback():
    """In production, when API call fails persistently, raise RuntimeError and NEVER return mock vectors."""
    prod_settings = Settings(
        ENVIRONMENT="production",
        AI_PROVIDER="gemini",
        GEMINI_API_KEY="test-production-key-123",
    )

    mock_client = mock.MagicMock()
    mock_client.models.embed_content.side_effect = Exception("503 Service Unavailable")

    with mock.patch("google.genai.Client", return_value=mock_client), \
         mock.patch("time.sleep"), \
         mock.patch("app.modules.legal_assistant.embedding_provider.settings", prod_settings):
        
        provider = GeminiEmbeddingProvider(api_key="test-production-key-123", max_retries=2)
        with pytest.raises(RuntimeError) as exc_info:
            provider.embed_query("What is anticipatory bail?")
        assert "Gemini embedding API call failed" in str(exc_info.value)
        # Crucial check: verify result was NOT silently substituted with mock data
        assert not hasattr(provider, "_is_mock_fallback_used")


# ──────────────────────────────────────────────────────────────
# 6. Batch Chunking & Documents Embedding
# ──────────────────────────────────────────────────────────────

def test_embed_documents_batch_chunking():
    """When more than MAX_BATCH_SIZE (50) texts are submitted, they are chunked into separate API calls."""
    mock_client = mock.MagicMock()

    total_docs = 65  # 50 in batch 1, 15 in batch 2
    docs = [f"Legal Section Chunk {i} content text." for i in range(total_docs)]

    def mock_embed_content(model, contents, config):
        count = len(contents)
        return mock.MagicMock(embeddings=[mock.MagicMock(values=make_unit_vector(768, 0.1)) for _ in range(count)])

    mock_client.models.embed_content.side_effect = mock_embed_content

    with mock.patch("google.genai.Client", return_value=mock_client):
        provider = GeminiEmbeddingProvider(api_key="test-key-123")
        results = provider.embed_documents(docs)

        assert len(results) == 65
        assert all(len(r) == 768 for r in results)
        # Must have made exactly 2 API calls (50 + 15)
        assert mock_client.models.embed_content.call_count == 2


# ──────────────────────────────────────────────────────────────
# 7. Database Re-Embedding Service Integration
# ──────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_reembed_all_chunks_service(db_session: AsyncSession):
    """Verify LegalIngestionService.reembed_all_chunks updates stored vectors to active provider."""
    # 1. Seed corpus
    await LegalIngestionService.seed_curated_corpus(db_session)

    # 2. Re-embed all chunks with active provider
    reembedded_count = await LegalIngestionService.reembed_all_chunks(db_session)
    assert reembedded_count >= 11

    # 3. Verify all chunks in database possess valid 768-D embeddings
    res = await db_session.execute(select(LegalChunk))
    chunks = res.scalars().all()
    assert len(chunks) == reembedded_count
    for chunk in chunks:
        assert chunk.embedding is not None
        assert len(chunk.embedding) == 768


# ──────────────────────────────────────────────────────────────
# 8. LegalRetrievalEngine Semantic Search Integration
# ──────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_legal_retrieval_engine_with_query_vector(db_session: AsyncSession):
    """Verify LegalRetrievalEngine uses semantic query embedding for retrieval."""
    await LegalIngestionService.seed_curated_corpus(db_session)

    chunks = await LegalRetrievalEngine.retrieve(
        db=db_session,
        query="What is the legal procedure when a cheque is dishonoured?",
        jurisdiction="Union of India",
        max_sources=3,
    )

    assert len(chunks) >= 1
    top_chunk = chunks[0]
    assert "Negotiable Instruments Act" in top_chunk["source_title"]
    assert "Section 138" in top_chunk["section_number"]

"""Test suite for AI Provider configuration, SDK dependency handling, and production safety."""

import sys
import unittest.mock as mock
import pytest
from httpx import ASGITransport, AsyncClient

from app.core.config import Settings, validate_ai_configuration
from app.modules.legal_assistant.embedding_provider import (
    DeterministicMockEmbeddingProvider,
    GeminiEmbeddingProvider,
    get_embedding_provider,
    reset_embedding_provider,
)
from app.modules.legal_assistant.llm_provider import (
    DeterministicGroundedLLMProvider,
    GeminiLLMProvider,
    get_llm_provider,
    reset_llm_provider,
)


@pytest.fixture(autouse=True)
def clean_provider_singletons():
    """Ensure provider singletons are reset before and after each test."""
    reset_llm_provider()
    reset_embedding_provider()
    yield
    reset_llm_provider()
    reset_embedding_provider()


# ──────────────────────────────────────────────────────────────
# 1. Development Mode with Explicit Mock Providers
# ──────────────────────────────────────────────────────────────

def test_development_startup_with_mock_providers():
    """Verify development mode cleanly initializes deterministic mock providers without external calls."""
    dev_settings = Settings(
        ENVIRONMENT="development",
        AI_PROVIDER="mock",
        GEMINI_API_KEY="",
    )

    # Startup validation must succeed without warnings or errors
    validate_ai_configuration(dev_settings)

    with mock.patch("app.modules.legal_assistant.llm_provider.settings", dev_settings), \
         mock.patch("app.modules.legal_assistant.embedding_provider.settings", dev_settings):
        
        llm = get_llm_provider(reload=True)
        assert isinstance(llm, DeterministicGroundedLLMProvider)

        embedding_provider = get_embedding_provider(reload=True)
        assert isinstance(embedding_provider, DeterministicMockEmbeddingProvider)
        assert embedding_provider.dimension == 768

        # Verify offline embedding generation succeeds
        vector = embedding_provider.get_embedding("cheque bounce section 138")
        assert len(vector) == 768
        assert any(v != 0.0 for v in vector)


def test_development_mode_handles_missing_optional_key_gracefully():
    """In development, missing GEMINI_API_KEY with AI_PROVIDER='mock' must not raise errors."""
    dev_settings = Settings(
        ENVIRONMENT="development",
        AI_PROVIDER="mock",
        GEMINI_API_KEY="",
    )
    validate_ai_configuration(dev_settings)


# ──────────────────────────────────────────────────────────────
# 2. Production Mode with Valid Provider Configuration
# ──────────────────────────────────────────────────────────────

def test_production_startup_with_valid_gemini_configuration():
    """Verify production mode correctly initializes Gemini providers when API key is provided."""
    prod_settings = Settings(
        ENVIRONMENT="production",
        AI_PROVIDER="gemini",
        GEMINI_API_KEY="AIzaSyValidProductionKeyForTestingOnly123",
        GEMINI_LLM_MODEL="gemini-2.5-flash",
        GEMINI_EMBEDDING_MODEL="text-embedding-004",
    )

    # Startup validation succeeds
    validate_ai_configuration(prod_settings)

    with mock.patch("app.modules.legal_assistant.llm_provider.settings", prod_settings), \
         mock.patch("app.modules.legal_assistant.embedding_provider.settings", prod_settings):
        
        llm = get_llm_provider(reload=True)
        assert isinstance(llm, GeminiLLMProvider)
        assert llm.model_name == "gemini-2.5-flash"
        assert llm.is_live is True

        embedding_provider = get_embedding_provider(reload=True)
        assert isinstance(embedding_provider, GeminiEmbeddingProvider)
        assert embedding_provider.model_name == "text-embedding-004"
        assert embedding_provider.dimension == 768
        assert embedding_provider.is_live is True


# ──────────────────────────────────────────────────────────────
# 3. Production Startup with Missing API Key
# ──────────────────────────────────────────────────────────────

def test_production_startup_fails_with_missing_api_key():
    """Production startup must fail with an actionable error if GEMINI_API_KEY is missing."""
    prod_settings = Settings(
        ENVIRONMENT="production",
        AI_PROVIDER="gemini",
        GEMINI_API_KEY="",
    )

    with pytest.raises(RuntimeError) as exc_info:
        validate_ai_configuration(prod_settings)
    assert "GEMINI_API_KEY is required in production" in str(exc_info.value)

    # Provider factory must also reject missing key in production
    with mock.patch("app.modules.legal_assistant.llm_provider.settings", prod_settings):
        with pytest.raises(RuntimeError) as exc_llm:
            get_llm_provider(reload=True)
        assert "GEMINI_API_KEY is required in production" in str(exc_llm.value)

    with mock.patch("app.modules.legal_assistant.embedding_provider.settings", prod_settings):
        with pytest.raises(RuntimeError) as exc_emb:
            get_embedding_provider(reload=True)
        assert "GEMINI_API_KEY is required in production" in str(exc_emb.value)


# ──────────────────────────────────────────────────────────────
# 4. Production Mode Must Never Silently Use Mock Providers
# ──────────────────────────────────────────────────────────────

def test_production_fails_if_mock_provider_is_configured():
    """Production must never silently accept AI_PROVIDER='mock'."""
    prod_mock_settings = Settings(
        ENVIRONMENT="production",
        AI_PROVIDER="mock",
        GEMINI_API_KEY="",
    )

    with pytest.raises(RuntimeError) as exc_info:
        validate_ai_configuration(prod_mock_settings)
    assert "AI_PROVIDER cannot be 'mock' in production" in str(exc_info.value)

    with mock.patch("app.modules.legal_assistant.llm_provider.settings", prod_mock_settings):
        with pytest.raises(RuntimeError) as exc_llm:
            get_llm_provider(reload=True)
        assert "AI_PROVIDER cannot be 'mock' in production" in str(exc_llm.value)

    with mock.patch("app.modules.legal_assistant.embedding_provider.settings", prod_mock_settings):
        with pytest.raises(RuntimeError) as exc_emb:
            get_embedding_provider(reload=True)
        assert "AI_PROVIDER cannot be 'mock' in production" in str(exc_emb.value)


def test_production_fails_on_unsupported_provider():
    """Production startup fails if an unsupported provider name is specified."""
    invalid_settings = Settings(
        ENVIRONMENT="production",
        AI_PROVIDER="openai-unsupported",
        GEMINI_API_KEY="some-key",
    )

    with pytest.raises(ValueError) as exc_info:
        validate_ai_configuration(invalid_settings)
    assert "Unsupported AI_PROVIDER" in str(exc_info.value)


# ──────────────────────────────────────────────────────────────
# 5. Missing SDK Dependency Handling
# ──────────────────────────────────────────────────────────────

def test_missing_sdk_dependency_handling_in_production():
    """When google-genai is not installed, production startup must raise an explicit actionable error."""
    prod_settings = Settings(
        ENVIRONMENT="production",
        AI_PROVIDER="gemini",
        GEMINI_API_KEY="test-key-12345",
    )

    # Simulate google-genai import failure
    with mock.patch.dict("sys.modules", {"google.genai": None, "google": None}):
        with pytest.raises(RuntimeError) as exc_info:
            validate_ai_configuration(prod_settings)
        assert "google-genai" in str(exc_info.value)


def test_missing_sdk_in_development_falls_back_gracefully():
    """In development, missing google-genai SDK must fall back to deterministic mock without crashing."""
    dev_settings = Settings(
        ENVIRONMENT="development",
        AI_PROVIDER="gemini",
        GEMINI_API_KEY="test-key",
    )

    with mock.patch.dict("sys.modules", {"google.genai": None, "google": None}):
        with mock.patch("app.modules.legal_assistant.llm_provider.settings", dev_settings):
            # Direct initialization in dev logs warning and uses fallback
            provider = GeminiLLMProvider(api_key="test-key")
            assert provider.is_live is False
            ans = provider.generate_legal_answer("What is bail?", [])
            assert "No verified legal sources found" in ans["answer"]


# ──────────────────────────────────────────────────────────────
# 6. Provider Initialization Failures
# ──────────────────────────────────────────────────────────────

def test_gemini_client_initialization_failure_in_production():
    """If client initialization throws an exception in production, an error is raised immediately."""
    prod_settings = Settings(
        ENVIRONMENT="production",
        AI_PROVIDER="gemini",
        GEMINI_API_KEY="test-key-12345",
    )

    with mock.patch("google.genai.Client", side_effect=Exception("Connection refused / Invalid credentials")):
        with mock.patch("app.modules.legal_assistant.llm_provider.settings", prod_settings):
            with pytest.raises(RuntimeError) as exc_info:
                GeminiLLMProvider(api_key="test-key-12345")
            assert "Failed to initialize Gemini LLM client in production" in str(exc_info.value)

        with mock.patch("app.modules.legal_assistant.embedding_provider.settings", prod_settings):
            with pytest.raises(RuntimeError) as exc_info:
                GeminiEmbeddingProvider(api_key="test-key-12345")
            assert "Failed to initialize Gemini embedding client in production" in str(exc_info.value)


def test_gemini_runtime_api_failure_in_production_does_not_mask_as_mock():
    """In production, runtime API failures must raise RuntimeError and never silently return mock data."""
    prod_settings = Settings(
        ENVIRONMENT="production",
        AI_PROVIDER="gemini",
        GEMINI_API_KEY="test-key-12345",
    )

    mock_client = mock.MagicMock()
    mock_client.models.generate_content.side_effect = Exception("Google Cloud Quota Exceeded 429")
    mock_client.models.embed_content.side_effect = Exception("Google Cloud Quota Exceeded 429")

    with mock.patch("google.genai.Client", return_value=mock_client), \
         mock.patch("app.modules.legal_assistant.llm_provider.settings", prod_settings), \
         mock.patch("app.modules.legal_assistant.embedding_provider.settings", prod_settings):
        
        llm = GeminiLLMProvider(api_key="test-key-12345")
        with pytest.raises(RuntimeError) as exc_llm:
            llm.generate_legal_answer("What is NI Act 138?", [{"section_number": "138", "chunk_text": "sample text"}])
        assert "Gemini LLM generation failed in production" in str(exc_llm.value)

        emb = GeminiEmbeddingProvider(api_key="test-key-12345")
        with pytest.raises(RuntimeError) as exc_emb:
            emb.get_embedding("cheque bounce")
        assert "Gemini embedding API call failed in production" in str(exc_emb.value)


# ──────────────────────────────────────────────────────────────
# 7. FastAPI Lifespan Startup Integration Test
# ──────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_fastapi_lifespan_blocks_misconfigured_production_startup():
    """Test that FastAPI app startup fails during lifespan in misconfigured production mode."""
    from app.main import app, lifespan

    prod_misconfigured = Settings(
        ENVIRONMENT="production",
        AI_PROVIDER="mock",
        GEMINI_API_KEY="",
    )

    with mock.patch("app.main.settings", prod_misconfigured):
        with pytest.raises(RuntimeError) as exc_info:
            async with lifespan(app):
                pass
        assert "AI_PROVIDER cannot be 'mock' in production" in str(exc_info.value)


@pytest.mark.asyncio
async def test_fastapi_lifespan_allows_valid_production_startup():
    """Test that FastAPI app startup succeeds during lifespan in valid production mode."""
    from app.main import app, lifespan

    prod_valid = Settings(
        ENVIRONMENT="production",
        AI_PROVIDER="gemini",
        GEMINI_API_KEY="AIzaSyTestValidProductionKeyForLifespan123",
        STORAGE_PROVIDER="r2",
        STORAGE_BUCKET="nyayasetu-vault-prod",
        STORAGE_ENDPOINT_URL="https://prod_account_12345.r2.cloudflarestorage.com",
        STORAGE_REGION="auto",
        STORAGE_ACCESS_KEY_ID="prod_access_key_12345",
        STORAGE_SECRET_ACCESS_KEY="prod_secret_key_12345",
    )

    with mock.patch("app.main.settings", prod_valid):
        async with lifespan(app):
            pass

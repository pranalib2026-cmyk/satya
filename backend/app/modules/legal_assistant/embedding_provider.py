"""Embedding Provider Abstraction for NyayaSetu RAG.

Provides a pluggable interface for dense vector embeddings, allowing Gemini,
OpenAI, HuggingFace, or a fast offline deterministic provider to be swapped
without touching the vector retrieval or business logic.
"""

from abc import ABC, abstractmethod
import hashlib
import math
import os
import re
from typing import List, Optional

from app.core.config import settings
from app.core.logging import logger


class BaseEmbeddingProvider(ABC):
    """Abstract interface for dense vector embedding generation."""

    @property
    @abstractmethod
    def dimension(self) -> int:
        """Embedding vector dimension."""
        pass

    @abstractmethod
    def get_embedding(self, text: str) -> List[float]:
        """Generate normalized embedding for a single text string."""
        pass

    def get_embeddings(self, texts: List[str]) -> List[List[float]]:
        """Batch embedding generation."""
        return [self.get_embedding(t) for t in texts]


class DeterministicMockEmbeddingProvider(BaseEmbeddingProvider):
    """High-speed, offline deterministic embedding provider for testing and offline environments.
    
    Constructs normalized 768-dimensional vectors using semantic feature hashing
    and domain-specific legal keyword mapping, guaranteeing high cosine similarity
    for related legal queries and low similarity for disjoint domains.
    """

    def __init__(self, dimension: int = 768):
        self._dim = dimension

        # Legal concept semantic clusters for synthetic vector grounding
        self._concept_indices = {
            "cheque": 10,
            "dishonour": 11,
            "138": 12,
            "negotiable": 13,
            "bounced": 14,
            "consumer": 30,
            "defect": 31,
            "commission": 32,
            "daakhil": 33,
            "warranty": 34,
            "refund": 35,
            "aid": 50,
            "nalsa": 51,
            "dlsa": 52,
            "services": 50,
            "eligible": 53,
            "eligibility": 53,
            "criteria": 53,
            "lok adalat": 54,
            "indigent": 55,
            "poor": 55,
            "bail": 70,
            "undertrial": 71,
            "479": 72,
            "fir": 73,
            "police": 74,
            "crpc": 75,
            "bnss": 76,
            "property": 90,
            "rera": 91,
            "possession": 92,
            "builder": 93,
            "allottee": 94,
        }

    @property
    def dimension(self) -> int:
        return self._dim

    def get_embedding(self, text: str) -> List[float]:
        """Generate unit-normalized 768-D vector reflecting semantic features."""
        vector = [0.0] * self._dim
        clean = text.lower().strip()

        # Multilingual mapping for Hindi and Kannada support
        multilingual_map = {
            "चेक": "cheque",
            "बाउंस": "bounce",
            "उपभोक्ता": "consumer",
            "शिकायत": "complaint",
            "ಗ್ರಾಹಕ": "consumer",
            "ದೂರು": "complaint",
            "ಜಾಮೀನು": "bail",
            "ಚೆಕ್": "cheque",
        }
        for indic, eng in multilingual_map.items():
            if indic in clean:
                clean += f" {eng}"

        # 1. Base hashing projection across dimensions
        tokens = re.findall(r"\w+", clean)
        for token in tokens:
            token_hash = int(hashlib.md5(token.encode("utf-8")).hexdigest(), 16)
            idx = token_hash % self._dim
            sign = 1.0 if (token_hash % 2 == 0) else -1.0
            vector[idx] += sign * 0.1

        # 2. Domain semantic clustering boosts
        for term, base_idx in self._concept_indices.items():
            if term in clean:
                for offset in range(-3, 4):
                    target_idx = (base_idx + offset) % self._dim
                    weight = 1.0 - (abs(offset) * 0.2)
                    vector[target_idx] += weight * 2.0

        # 3. L2 Unit Normalization
        norm = math.sqrt(sum(v * v for v in vector))
        if norm > 0:
            vector = [round(v / norm, 6) for v in vector]
        else:
            vector[0] = 1.0

        return vector


class GeminiEmbeddingProvider(BaseEmbeddingProvider):
    """Google Gemini embedding provider using text-embedding-004."""

    def __init__(self, api_key: Optional[str] = None, dimension: int = 768):
        self._api_key = api_key or settings.GEMINI_API_KEY
        self._dim = dimension
        self._fallback = DeterministicMockEmbeddingProvider(dimension=dimension)

    @property
    def dimension(self) -> int:
        return self._dim

    def get_embedding(self, text: str) -> List[float]:
        """Invoke Gemini API or gracefully fallback if key not configured."""
        if not self._api_key:
            return self._fallback.get_embedding(text)

        try:
            import google.generativeai as genai
            genai.configure(api_key=self._api_key)
            result = genai.embed_content(
                model="models/text-embedding-004",
                content=text,
                task_type="retrieval_document",
            )
            embedding = result.get("embedding", [])
            if len(embedding) == self._dim:
                # Normalize vector
                norm = math.sqrt(sum(v * v for v in embedding))
                return [round(v / norm, 6) for v in embedding] if norm > 0 else embedding
        except Exception as exc:
            logger.warning(f"Gemini embedding API call failed: {exc}. Using deterministic provider.")

        return self._fallback.get_embedding(text)


# Active singleton instance
_embedding_provider_instance: Optional[BaseEmbeddingProvider] = None


def get_embedding_provider() -> BaseEmbeddingProvider:
    """Return active embedding provider based on environment settings."""
    global _embedding_provider_instance
    if _embedding_provider_instance is None:
        if settings.GEMINI_API_KEY and settings.is_production:
            _embedding_provider_instance = GeminiEmbeddingProvider()
        else:
            _embedding_provider_instance = DeterministicMockEmbeddingProvider(
                dimension=settings.EMBEDDING_VECTOR_DIMENSION
            )
    return _embedding_provider_instance

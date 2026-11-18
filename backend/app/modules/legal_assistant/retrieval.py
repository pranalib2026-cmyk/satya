"""Vector and Hybrid Retrieval Engine for Indian Legal Corpus."""

import math
import re
from typing import Any, Dict, List, Optional
from uuid import UUID

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.logging import logger
from app.modules.legal_assistant.embedding_provider import get_embedding_provider
from app.modules.legal_knowledge.models import LegalChunk, LegalSource


def cosine_similarity(v1: List[float], v2: List[float]) -> float:
    """Calculate cosine similarity between two float vectors."""
    if not v1 or not v2 or len(v1) != len(v2):
        return 0.0
    dot = sum(a * b for a, b in zip(v1, v2))
    norm1 = math.sqrt(sum(a * a for a in v1))
    norm2 = math.sqrt(sum(b * b for b in v2))
    if norm1 == 0 or norm2 == 0:
        return 0.0
    return dot / (norm1 * norm2)


class LegalRetrievalEngine:
    """Hybrid semantic vector and statutory keyword retriever over official Indian legal sources."""

    @classmethod
    async def retrieve(
        cls,
        db: AsyncSession,
        query: str,
        jurisdiction: Optional[str] = None,
        max_sources: int = 5,
    ) -> List[Dict[str, Any]]:
        """Retrieve relevant legal chunks using hybrid vector similarity and statutory keyword matching."""
        embedding_provider = get_embedding_provider()
        query_vector = embedding_provider.get_embedding(query)

        # 1. Base query joining chunk with source
        stmt = select(LegalChunk).join(LegalSource, LegalChunk.source_id == LegalSource.id).options(
            selectinload(LegalChunk.source)
        )

        # 2. Metadata filtering: match local jurisdiction OR Union of India (national applicability)
        if jurisdiction and jurisdiction.strip():
            j_clean = jurisdiction.strip().lower()
            stmt = stmt.where(
                or_(
                    LegalSource.jurisdiction.ilike(f"%{j_clean}%"),
                    LegalSource.jurisdiction == "Union of India",
                    LegalSource.jurisdiction == "Supreme Court of India / Bharat Central",
                )
            )

        res = await db.execute(stmt)
        all_chunks = res.scalars().all()

        if not all_chunks:
            return []

        # 3. Hybrid Scoring (Vector Cosine Similarity + Statutory Keyword Matching)
        query_lower = query.lower()

        # Multilingual legal terms transliteration mapping (Hindi & Kannada -> English concepts)
        multilingual_map = {
            "चेक": "cheque",
            "बाउंस": "bounce",
            "उपभोक्ता": "consumer",
            "शिकायत": "complaint",
            "कानूनी": "legal",
            "प्रक्रिया": "procedure",
            "ಗ್ರಾಹಕ": "consumer",
            "ಗ್ರಾಹಕರ": "consumer",
            "ರಕ್ಷಣಾ": "protection",
            "ಕಾಯ್ದೆ": "act",
            "ದೂರು": "complaint",
            "ಜಾಮೀನು": "bail",
            "ಚೆಕ್": "cheque",
        }
        expanded_query = query_lower
        for indic_word, eng_equiv in multilingual_map.items():
            if indic_word in expanded_query:
                expanded_query += f" {eng_equiv}"

        query_tokens = set(re.findall(r"\w+", expanded_query))
        section_matches = set(re.findall(r"\b\d+\b", expanded_query))

        scored_candidates: List[Tuple[float, LegalChunk]] = []

        for chunk in all_chunks:
            chunk_embedding = chunk.embedding
            # Convert vector if serialized as list/array
            if isinstance(chunk_embedding, list):
                v_score = cosine_similarity(query_vector, chunk_embedding)
            elif hasattr(chunk_embedding, "tolist"):
                v_score = cosine_similarity(query_vector, chunk_embedding.tolist())
            else:
                v_score = 0.5  # fallback baseline

            # Keyword and section overlap boost
            kw_score = 0.0
            sec_num = (chunk.section_number or "").lower()
            heading = (chunk.clause_heading or "").lower()
            chunk_text = chunk.chunk_text.lower()
            source_title = (chunk.source.title if chunk.source else "").lower()

            # Exact section number hit
            for sec in section_matches:
                if sec in sec_num:
                    kw_score += 0.50

            # Legal Aid / NALSA mapping
            if any(t in query_lower for t in ["aid", "nalsa", "free legal aid", "poor"]):
                if "legal services" in source_title or "12" in sec_num or "aid" in heading:
                    kw_score += 0.50

            # Cheque Bounce mapping
            if any(t in query_lower for t in ["cheque", "dishonour", "bounce"]):
                if "138" in sec_num or "negotiable" in source_title:
                    kw_score += 0.40

            # Title or heading terms
            for token in query_tokens:
                if len(token) > 3:
                    if token in sec_num:
                        kw_score += 0.20
                    if token in heading:
                        kw_score += 0.15
                    if token in source_title:
                        kw_score += 0.10
                    if token in chunk_text:
                        kw_score += 0.05

            composite_score = (v_score * 0.70) + (min(kw_score, 1.0) * 0.30)
            scored_candidates.append((composite_score, chunk))

        # 4. Rank by composite score descending
        scored_candidates.sort(key=lambda x: x[0], reverse=True)

        # 5. Extract top candidates meeting minimum threshold (>= 0.45)
        top_chunks = []
        for score, chunk in scored_candidates:
            if score < 0.45:
                # Do not retrieve ungrounded / irrelevant matches
                continue

            src = chunk.source
            top_chunks.append({
                "chunk_id": str(chunk.id),
                "source_id": str(chunk.source_id),
                "source_title": src.title if src else "Official Indian Statute",
                "source_type": src.source_type if src else "BARE_ACT",
                "act_or_judgment_identifier": src.act_or_judgment_identifier if src else None,
                "citation": src.citation if src else None,
                "section_number": chunk.section_number,
                "clause_heading": chunk.clause_heading,
                "chunk_text": chunk.chunk_text,
                "official_source_url": src.official_source_url if src else None,
                "content_checksum": chunk.content_checksum,
                "score": round(score, 4),
            })

            if len(top_chunks) >= max_sources:
                break

        return top_chunks
